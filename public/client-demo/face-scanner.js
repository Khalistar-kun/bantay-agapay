/* Bantay-Agapay face scanning: on-device face landmarks and prompted motion.
   NOT face recognition or proof against spoofing. School security makes the entry decision.
   MediaPipe processes video on the device; CDN assets load only on scanner start.
   Model loads from Google's published face-landmarker bundle. */
(function (root) {
  'use strict';
  const MODULE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs';
  const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  let modelPromise = null;

  function getModel() {
    if (!modelPromise) {
      modelPromise = (async function () {
        const vision = await import(MODULE);
        const files = await vision.FilesetResolver.forVisionTasks(WASM);
        return vision.FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
          runningMode: 'VIDEO', numFaces: 2,
          minFaceDetectionConfidence: 0.55, minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5, outputFaceBlendshapes: true,
        });
      })().catch(function (err) { modelPromise = null; throw err; });
    }
    return modelPromise;
  }
  function shapeScore(result, key) {
    const categories = result.faceBlendshapes?.[0]?.categories || [];
    const match = categories.find(function (c) { return c.categoryName === key; });
    return match && Number.isFinite(match.score) ? match.score : 0;
  }
  function facePose(result) {
    const faces = result.faceLandmarks || [];
    if (faces.length !== 1) return { ok: false, message: faces.length > 1 ? 'Only one person may appear in the camera.' : 'Move your face into the frame.' };
    const face = faces[0];
    if (!face || face.length < 455) return { ok: false, message: 'Face landmarks are not ready yet.' };
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of face) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const w = maxX - minX, h = maxY - minY, cx = (maxX + minX) / 2, cy = (maxY + minY) / 2;
    if (w < .19 || h < .22) return { ok: false, message: 'Move closer to the camera.' };
    if (minX < .02 || maxX > .98 || minY < .02 || maxY > .98 || Math.abs(cx - .5) > .22 || Math.abs(cy - .5) > .24) return { ok: false, message: 'Keep your entire face centered on screen.' };
    const left = face[234], right = face[454], nose = face[1];
    const eyeSpan = right.x - left.x;
    if (!Number.isFinite(eyeSpan) || Math.abs(eyeSpan) < .08) return { ok: false, message: 'Face position unclear; look at the camera.' };
    // Nose shift relative to cheek edges estimates head rotation, not identity.
    const yaw = (nose.x - (left.x + right.x) / 2) / Math.abs(eyeSpan);
    const blink = Math.min(shapeScore(result, 'eyeBlinkLeft'), shapeScore(result, 'eyeBlinkRight'));
    return { ok: true, yaw, blink };
  }

  function createProgress() {
    return { phase: 'center', stable: 0, neutral: 0, closed: false, firstSide: 0, misses: 0, ready: false, message: 'Center your face in the camera.' };
  }
  function advance(progress, result) {
    if (progress.ready) return progress;
    const pose = facePose(result);
    if (!pose.ok) {
      progress.misses++;
      progress.stable = 0;
      progress.message = pose.message;
      // A different person entering the frame must restart the prompted sequence.
      if (progress.misses >= 6) Object.assign(progress, createProgress(), { message: pose.message });
      return progress;
    }
    progress.misses = 0;
    const centered = Math.abs(pose.yaw - progress.neutral) < .09;
    switch (progress.phase) {
      case 'center':
        progress.neutral = progress.stable === 0 ? pose.yaw : progress.neutral * .8 + pose.yaw * .2;
        progress.stable++;
        progress.message = 'Look straight at the camera and hold still.';
        if (progress.stable >= 5) { progress.phase = 'blink'; progress.stable = 0; progress.message = 'Blink both eyes once.'; }
        break;
      case 'blink':
        if (pose.blink > .53) progress.closed = true;
        if (progress.closed && pose.blink < .24) {
          progress.phase = 'first-turn';
          progress.message = 'Turn your head slightly to one side.';
        } else progress.message = 'Blink both eyes once.';
        break;
      case 'first-turn':
        if (Math.abs(pose.yaw - progress.neutral) > .12) {
          progress.stable++;
          progress.firstSide = Math.sign(pose.yaw - progress.neutral);
        } else progress.stable = 0;
        progress.message = 'Turn your head slightly to one side.';
        if (progress.stable >= 2) { progress.stable = 0; progress.phase = 'back-center'; progress.message = 'Return to the center.'; }
        break;
      case 'back-center':
        progress.stable = centered ? progress.stable + 1 : 0;
        progress.message = 'Return to the center.';
        if (progress.stable >= 2) { progress.stable = 0; progress.phase = 'second-turn'; progress.message = 'Now turn your head to the opposite side.'; }
        break;
      case 'second-turn':
        progress.stable = Math.sign(pose.yaw - progress.neutral) === -progress.firstSide && Math.abs(pose.yaw - progress.neutral) > .12 ? progress.stable + 1 : 0;
        progress.message = 'Now turn your head to the opposite side.';
        if (progress.stable >= 2) { progress.stable = 0; progress.phase = 'final-center'; progress.message = 'Face the camera again for your photo.'; }
        break;
      case 'final-center':
        progress.stable = centered ? progress.stable + 1 : 0;
        progress.message = 'Face the camera again for your photo.';
        if (progress.stable >= 3) { progress.ready = true; progress.phase = 'ready'; progress.message = 'Motion check complete. Capture your photo for security review.'; }
        break;
    }
    return progress;
  }

  function start(video, callbacks) {
    const onProgress = callbacks?.onProgress || function () {};
    const onError = callbacks?.onError || function () {};
    let stopped = false, frameId = 0, lastTime = -1, lastRun = 0, model = null, progress = createProgress();
    const tick = function (now) {
      if (stopped || progress.ready) return;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && (now - lastRun >= 110) && video.currentTime !== lastTime) {
        lastRun = now;
        lastTime = video.currentTime;
        try {
          const result = model.detectForVideo(video, now);
          advance(progress, result);
          onProgress({ ...progress });
        } catch (err) {
          onError(new Error('Face analysis stopped. Retry the camera or use manual photo review.'));
          stop();
          return;
        }
      }
      frameId = root.requestAnimationFrame(tick);
    };
    function stop() { stopped = true; if (frameId) root.cancelAnimationFrame(frameId); }
    const ready = getModel().then(function (loaded) {
      if (stopped) return;
      model = loaded;
      onProgress({ ...progress });
      frameId = root.requestAnimationFrame(tick);
    }).catch(function () {
      if (!stopped) onError(new Error('Face scanner could not load. Check your internet connection or use manual photo review.'));
    });
    return { stop, ready, isReady: function () { return !stopped && progress.ready; }, reset: function () { progress = createProgress(); if (!stopped && !frameId && model) frameId = root.requestAnimationFrame(tick); } };
  }

  root.BantayFaceScan = { start, evaluate: advance, newProgress: createProgress, inspect: facePose };
})(window);
