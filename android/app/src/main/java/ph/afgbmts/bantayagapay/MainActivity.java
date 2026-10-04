package ph.afgbmts.bantayagapay;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private static final String CONNECT_PAGE = "https://appassets.androidplatform.net/assets/connect.html";
    private WebView browser;
    private ProgressBar progress;
    private String server;
    private PermissionRequest cameraRequest;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        server = getPreferences(MODE_PRIVATE).getString("server", BuildConfig.SERVER_URL);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setFitsSystemWindows(true);
        content.setBackgroundColor(Color.rgb(250, 248, 245));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        content.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        browser = new WebView(this);
        content.addView(browser, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(content);
        if (getActionBar() != null) {
            getActionBar().setTitle("Bantay-Agapay");
            getActionBar().setSubtitle("AFGBMTS");
        }
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        browser.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return false;
                if ("bantay".equals(uri.getScheme()) && view.getUrl() != null && view.getUrl().startsWith(CONNECT_PAGE)) {
                    if ("connect".equals(uri.getHost())) configureServer();
                    else if ("retry".equals(uri.getHost())) openServer();
                    return true;
                }
                if (isServerOrigin(uri.toString()) || CONNECT_PAGE.equals(uri.toString())) return false;
                if ("https".equals(uri.getScheme()) || "tel".equals(uri.getScheme()) || "mailto".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                progress.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !CONNECT_PAGE.equals(request.getUrl().toString())) showConnectionPage();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) showConnectionPage();
            }
        });
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int percent) {
                progress.setVisibility(percent < 100 ? View.VISIBLE : View.GONE);
                progress.setProgress(percent);
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!isServerOrigin(request.getOrigin().toString()) || !isServerOrigin(browser.getUrl())) { request.deny(); return; }
                    if (cameraRequest != null) { request.deny(); return; }
                    boolean video = false;
                    for (String resource : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) video = true;
                    if (!video) { request.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        cameraRequest = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, 100);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (cameraRequest == request) cameraRequest = null; }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!isServerOrigin(origin) || !isServerOrigin(browser.getUrl()) || locationCallback != null) { callback.invoke(origin, false, false); return; }
                if (hasLocationPermission()) callback.invoke(origin, true, false);
                else {
                    locationOrigin = origin;
                    locationCallback = callback;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION}, 101);
                }
            }
        });
        if (state != null && browser.restoreState(state) != null) return;
        openServer();
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isServerOrigin(String candidate) {
        if (server == null || server.isEmpty() || candidate == null) return false;
        Uri expected = Uri.parse(server), actual = Uri.parse(candidate);
        return "https".equals(actual.getScheme()) && expected.getHost() != null
            && expected.getHost().equalsIgnoreCase(actual.getHost()) && expected.getPort() == actual.getPort();
    }

    private boolean validServer(String candidate) {
        Uri uri = Uri.parse(candidate);
        return "https".equals(uri.getScheme()) && uri.getHost() != null && !uri.getHost().isEmpty()
            && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
            && (uri.getPath() == null || uri.getPath().isEmpty() || "/".equals(uri.getPath()));
    }

    private void openServer() {
        if (server == null || !validServer(server)) { showConnectionPage(); return; }
        browser.loadUrl(server);
    }

    private void showConnectionPage() {
        browser.stopLoading();
        browser.loadUrl(CONNECT_PAGE);
    }

    private void configureServer() {
        EditText field = new EditText(this);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        field.setSingleLine(true);
        field.setText(server);
        field.setHint("https://your-school-server.example");
        int padding = (int) (20 * getResources().getDisplayMetrics().density);
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setPadding(padding, padding, padding, padding);
        wrapper.addView(field, new LinearLayout.LayoutParams(-1, -2));
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("School server")
            .setMessage("Use the HTTPS address of your school’s Bantay-Agapay server. Staff login and visitor records use its existing database.")
            .setView(wrapper).setNegativeButton("Cancel", null).setPositiveButton("Connect", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String candidate = field.getText().toString().trim();
            if (!validServer(candidate)) { field.setError("Enter a full HTTPS address without a path"); return; }
            server = candidate.replaceAll("/+$", "");
            getPreferences(MODE_PRIVATE).edit().putString("server", server).apply();
            dialog.dismiss();
            browser.clearHistory();
            openServer();
        }));
        dialog.show();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 100 && cameraRequest != null) {
            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                && isServerOrigin(cameraRequest.getOrigin().toString()) && isServerOrigin(browser.getUrl())) cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else cameraRequest.deny();
            cameraRequest = null;
        }
        if (code == 101 && locationCallback != null) {
            locationCallback.invoke(locationOrigin, hasLocationPermission() && isServerOrigin(locationOrigin) && isServerOrigin(browser.getUrl()), false);
            locationCallback = null;
        }
    }

    @Override public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "Home");
        menu.add(0, 2, 1, "Refresh");
        menu.add(0, 3, 2, "School server");
        return true;
    }
    @Override public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1: openServer(); return true;
            case 2: browser.reload(); return true;
            case 3: configureServer(); return true;
            default: return super.onOptionsItemSelected(item);
        }
    }
    @Override public void onBackPressed() { if (browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); browser.saveState(state); }
    @Override protected void onPause() { browser.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (browser != null) browser.onResume(); }
    @Override protected void onDestroy() {
        if (cameraRequest != null) cameraRequest.deny();
        if (locationCallback != null) locationCallback.invoke(locationOrigin, false, false);
        browser.destroy();
        super.onDestroy();
    }
}
