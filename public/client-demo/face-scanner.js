/* Bantay-Agapay adaptive face-motion scanner.
 * Face landmarks and frames stay on device; external assets provide the model.
 * Motion is NOT proof of identity, human presence, or spoof resistance.
 * A guard must manually review the photo and approve every entry. */
(function (root) {
  'use strict';
  const VERSION = '0.10.35';
  const MODULE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/vision_bundle.mjs';
  const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/wasm';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  let modelPromise;

  function getModel() {
    if (!modelPromise) modelPromise = (async function () {
      const vision = await import(MODULE);
      const files = await vision.FilesetResolver.forVisionTasks(WASM);
      return vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 2,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: true,
      });
    })().catch(function (error) { modelPromise = null; throw error; });
    return modelPromise;
  }

  function blendshape(result, name) {
    const categories = result?.faceBlendshapes?.[0]?.categories || [];
    const hit = categories.find(function (value) { return value.categoryName === name; });
    return hit && Number.isFinite(hit.score) ? hit.score : null;
  }

  function inspect(result) {
    const faces = result?.faceLandmarks || [];
    if (faces.length !== 1) return {
      ok: false, message: faces.length > 1
        ? 'Only one person should be visible in the square camera box.'
        : 'No face detected. Move into the square guide.',
    };
    const points = faces[0];
    if (!points || points.length < 455) return { ok: false, message: 'Finding face landmarks. Hold still.' };
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return { ok: false, message: 'Camera tracking lost. Hold still.' };
      }
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    const width = maxX - minX, height = maxY - minY;
    const centerX = (maxX + minX) / 2, centerY = (maxY + minY) / 2;
    if (width < .18 || height < .22) return { ok: false, message: 'Move closer to the camera.' };
    if (width > .80 || height > .88) return { ok: false, message: 'Move back so your full face fits.' };
    if (minX < .02 || maxX > .98 || minY < .02 || maxY > .98 ||
        Math.abs(centerX - .5) > .20 || Math.abs(centerY - .5) > .23) {
      return { ok: false, message: 'Center your face inside the square guide.' };
    }
    const left = points[234], right = points[454], nose = points[1];
    const span = Math.abs(right.x - left.x);
    if (span < .07) return { ok: false, message: 'Look more directly toward the camera.' };
    const yaw = (nose.x - (left.x + right.x) / 2) / span;
    const a = blendshape(result, 'eyeBlinkLeft');
    const b = blendshape(result, 'eyeBlinkRight');
    return { ok: true, yaw, blink: a === null || b === null ? null : Math.min(a, b) };
  }

  // Local, coarse image-quality hints. The algorithm never reads skin tones,
  // infers identity or exposes the camera frame.
  function checkQuality(video, canvas) {
    if (!canvas || !video?.videoWidth) return { ok: true, available: false };
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return { ok: true, available: false };
      const w = video.videoWidth, h = video.videoHeight, side = Math.min(w, h);
      ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 48, 48);
      const rgba = ctx.getImageData(0, 0, 48, 48).data;
      const lum = new Float32Array(48 * 48);
      let sum = 0, sumSquare = 0, edge = 0;
      for (let i = 0; i < lum.length; i++) {
        const k = i * 4, y = rgba[k] * .2126 + rgba[k + 1] * .7152 + rgba[k + 2] * .0722;
        lum[i] = y;
        sum += y;
        sumSquare += y * y;
      }
      const mean = sum / lum.length;
      const contrast = Math.sqrt(Math.max(0, sumSquare / lum.length - mean * mean));
      for (let row = 1; row < 47; row++) for (let column = 1; column < 47; column++) {
        const i = row * 48 + column;
        edge += Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - 48]);
      }
      const detail = edge / (46 * 46 * 2);
      if (mean < 31) return { ok: false, message: 'Too dark. Face a light source.' };
      if (mean > 231) return { ok: false, message: 'Too bright. Move away from direct glare.' };
      if (contrast < 12 && detail < 4) return { ok: false, message: 'Low contrast. Try more even lighting.' };
      if (detail < 1.8) return { ok: false, message: 'Blurry image. Clean the lens and hold still.' };
      return { ok: true, available: true };
    } catch (_) {
      return { ok: true, available: false };
    }
  }

  function randomOrder(rng) {
    const random = rng || function () {
      if (root.crypto && root.crypto.getRandomValues) {
        const value = new Uint32Array(1);
        root.crypto.getRandomValues(value);
        return value[0] / 4294967296;
      }
      return Math.random();
    };
    return random() < .5 ? ['blink', 'turn', 'opposite'] : ['turn', 'opposite', 'blink'];
  }

  const hints = {
    blink: 'Blink both eyes once, then open them.',
    turn: 'Turn your head slowly to either side.',
    opposite: 'Now turn your head to the opposite side.',
  };

  function newProgress(order) {
    const challenge = Array.isArray(order) && order.length === 3 ? order.slice() : randomOrder();
    return {
      phase: 'center', challenge, step: 0, steady: 0, missed: 0,
      neutral: 0, firstDirection: 0, closed: false, openFrames: 0,
      ready: false, captureSafe: false, percent: 0,
      message: 'Center your face in the square camera guide.',
    };
  }

  function advance(progress, result, quality) {
    const pose = inspect(result);
    if (!pose.ok || (quality && !quality.ok)) {
      progress.missed++;
      progress.steady = 0;
      progress.captureSafe = false;
      progress.message = !pose.ok ? pose.message : quality.message;
      // Reset the sequence after sustained loss/multiple people, not one bad frame.
      if (progress.missed >= 6) {
        const order = progress.challenge;
        Object.assign(progress, newProgress(order), { message: progress.message });
      }
      return progress;
    }
    progress.missed = 0;
    const centered = Math.abs(pose.yaw - progress.neutral) < .095;
    if (progress.ready) {
      progress.captureSafe = centered;
      progress.message = centered
        ? 'Motion prompts complete. Capture your photo for guard review.'
        : 'Face the camera again before capturing your photo.';
      return progress;
    }
    if (progress.phase === 'center') {
      progress.neutral = progress.steady === 0 ? pose.yaw : .8 * progress.neutral + .2 * pose.yaw;
      progress.steady++;
      progress.message = 'Look straight ahead and hold still.';
      if (progress.steady >= 5) {
        progress.phase = 'challenge'; progress.steady = 0; progress.percent = 18;
        progress.message = hints[progress.challenge[progress.step]];
      }
      return progress;
    }
    if (progress.phase === 'recover') {
      progress.steady = centered ? progress.steady + 1 : 0;
      progress.message = 'Return your head to the center.';
      if (progress.steady >= 2) {
        progress.phase = 'challenge'; progress.steady = 0;
        progress.message = hints[progress.challenge[progress.step]];
      }
      return progress;
    }
    if (progress.phase === 'final') {
      progress.steady = centered ? progress.steady + 1 : 0;
      progress.message = 'Face the camera and hold still for your photo.';
      if (progress.steady >= 4) {
        progress.ready = true; progress.captureSafe = true;
        progress.phase = 'ready'; progress.percent = 100;
        progress.message = 'Motion prompts complete. Capture your photo for guard review.';
      }
      return progress;
    }
    const action = progress.challenge[progress.step];
    let completed = false;
    if (action === 'blink') {
      if (pose.blink === null) progress.message = 'Eye tracking unavailable. Retry or use manual photo review.';
      else if (!centered) progress.message = 'Look straight ahead for the blink.';
      else if (!progress.closed && pose.blink >= .55) {
        progress.closed = true; progress.openFrames = 0;
        progress.message = 'Open both eyes again.';
      } else if (progress.closed) {
        progress.openFrames = pose.blink < .25 ? progress.openFrames + 1 : 0;
        progress.message = 'Open both eyes again.';
        completed = progress.openFrames >= 2;
      } else progress.message = hints.blink;
    } else if (action === 'turn') {
      const delta = pose.yaw - progress.neutral;
      if (Math.abs(delta) >= .12) {
        progress.steady++;
        progress.firstDirection = Math.sign(delta);
      } else progress.steady = 0;
      progress.message = hints.turn;
      completed = progress.steady >= 2;
    } else if (action === 'opposite') {
      const delta = pose.yaw - progress.neutral;
      progress.steady = Math.abs(delta) >= .12 && Math.sign(delta) === -progress.firstDirection
        ? progress.steady + 1 : 0;
      progress.message = hints.opposite;
      completed = progress.steady >= 2;
    }
    if (completed) {
      progress.step++;
      progress.steady = 0; progress.closed = false; progress.openFrames = 0;
      progress.percent = 18 + Math.round(72 * progress.step / 3);
      if (progress.step >= progress.challenge.length) {
        progress.phase = 'final';
        progress.message = 'Face the camera for the final photo.';
      } else {
        progress.phase = action === 'turn' || action === 'opposite' ? 'recover' : 'challenge';
        progress.message = progress.phase === 'recover'
          ? 'Return your head to the center.'
          : hints[progress.challenge[progress.step]];
      }
    }
    return progress;
  }

  function start(video, callbacks) {
    const onProgress = callbacks?.onProgress || function () {};
    const onError = callbacks?.onError || function () {};
    let stopped = false, frameId = 0, lastTime = -1, lastRun = 0, model;
    const progress = newProgress();
    const scratch = typeof root.document?.createElement === 'function'
      ? root.document.createElement('canvas') : null;
    if (scratch) { scratch.width = 48; scratch.height = 48; }
    let quality = { ok: true, available: false }, ticks = 0;
    function tick(now) {
      if (stopped) return;
      if (model && video && video.readyState >= 2 && video.videoWidth > 0 &&
          now - lastRun >= 105 && video.currentTime !== lastTime) {
        lastRun = now;
        lastTime = video.currentTime;
        try {
          if (++ticks % 3 === 1) quality = checkQuality(video, scratch);
          advance(progress, model.detectForVideo(video, now), quality);
          onProgress({ ...progress, ready: progress.ready && progress.captureSafe });
        } catch (_) {
          onError(new Error('Face analysis stopped. Retry the camera or use manual photo review.'));
          stop();
          return;
        }
      }
      frameId = root.requestAnimationFrame(tick);
    }
    function stop() { stopped = true; if (frameId) root.cancelAnimationFrame(frameId); }
    const ready = getModel().then(function (loaded) {
      if (stopped) return;
      model = loaded;
      onProgress({ ...progress });
      frameId = root.requestAnimationFrame(tick);
    }).catch(function () {
      if (!stopped) {
        onError(new Error('Face scanner could not load. Check your connection or use manual photo review.'));
        stop();
      }
    });
    return {
      stop, ready,
      isReady: function () { return !stopped && progress.ready && progress.captureSafe; },
      reset: function () {
        Object.assign(progress, newProgress());
        if (!stopped) onProgress({ ...progress });
      },
    };
  }

  root.BantayFaceScan = {
    start, inspect, evaluate: advance, newProgress, randomOrder, checkQuality,
  };
})(window);
