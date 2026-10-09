package com.jobprep.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

public final class MainActivity extends Activity {
    public static final String EXTRA_WIDGET_DESTINATION = "widget_destination";
    public static final String EXTRA_WIDGET_QUESTION_ID = "widget_question_id";
    private static final int PICK_DOCUMENT = 421;
    private static final String VERIFIER_KEY = "oauth_verifier";
    private static final String VERIFIER_TIME_KEY = "oauth_verifier_time";
    private static final int NAVY = Color.rgb(16, 27, 46);
    private static final int BLUE = Color.rgb(53, 121, 246);
    private WebView webView;
    private FrameLayout webArea;
    private LinearLayout offlinePanel;
    private LinearLayout bottomNavigation;
    private ProgressBar progress;
    private ValueCallback<Uri[]> pendingFile;
    private ConnectivityManager connectivity;
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean pageError;
    private boolean authRedirecting;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        buildLayout();
        configureWebView();
        connectivity = getSystemService(ConnectivityManager.class);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) { runOnUiThread(() -> onNetworkChanged()); }
            @Override public void onLost(Network network) { runOnUiThread(() -> onNetworkChanged()); }
        };
        connectivity.registerDefaultNetworkCallback(networkCallback);
        if (state == null || webView.restoreState(state) == null) {
            String destination = widgetDestination(getIntent());
            webView.loadUrl(BuildConfig.WEB_ORIGIN + (destination == null ? "/dashboard" : destination));
        }
        handleDeepLink(getIntent());
        onNetworkChanged();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setAllCaps(false);
        b.setTextSize(13);
        b.setBackgroundColor(NAVY);
        b.setMinHeight(dp(56));
        return b;
    }

    private void buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
            android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
            root.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            if (bottomNavigation != null) bottomNavigation.setVisibility(ime.bottom > bars.bottom ? View.GONE : View.VISIBLE);
            return insets;
        });
        webArea = new FrameLayout(this);
        webView = new WebView(this);
        webArea.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        webArea.addView(progress, new FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP));
        offlinePanel = new LinearLayout(this);
        offlinePanel.setOrientation(LinearLayout.VERTICAL);
        offlinePanel.setGravity(Gravity.CENTER);
        offlinePanel.setPadding(dp(24), dp(24), dp(24), dp(24));
        offlinePanel.setBackgroundColor(Color.WHITE);
        TextView title = new TextView(this);
        title.setText("JobPrep is offline");
        title.setTextSize(22);
        title.setTextColor(NAVY);
        title.setGravity(Gravity.CENTER);
        offlinePanel.addView(title);
        TextView details = new TextView(this);
        details.setText("Check your connection. Your open interview stays on this device. Try again when the network returns.");
        details.setTextSize(15);
        details.setTextColor(Color.DKGRAY);
        details.setGravity(Gravity.CENTER);
        details.setPadding(0, dp(12), 0, dp(20));
        offlinePanel.addView(details);
        Button retry = button("Retry");
        retry.setBackgroundColor(BLUE);
        retry.setOnClickListener(v -> retryPage());
        offlinePanel.addView(retry, new LinearLayout.LayoutParams(-1, dp(56)));
        offlinePanel.setVisibility(View.GONE);
        webArea.addView(offlinePanel, new FrameLayout.LayoutParams(-1, -1));
        root.addView(webArea, new LinearLayout.LayoutParams(-1, 0, 1));
        bottomNavigation = new LinearLayout(this);
        bottomNavigation.setBackgroundColor(NAVY);
        String[] labels = {"Home", "Practice", "History", "Settings"};
        String[] paths = {"/dashboard", "/sessions/today", "/history", "/settings"};
        for (int i = 0; i < labels.length; i++) {
            final String path = paths[i];
            Button tab = button(labels[i]);
            tab.setOnClickListener(v -> confirmIfAnswerPresent(() -> webView.loadUrl(BuildConfig.WEB_ORIGIN + path)));
            bottomNavigation.addView(tab, new LinearLayout.LayoutParams(0, dp(60), 1));
        }
        root.addView(bottomNavigation, new LinearLayout.LayoutParams(-1, dp(60)));
        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Android document picker URIs for resume uploads.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        webView.addJavascriptInterface(new AuthBridge(), "JobPrepAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isInternal(uri)) return false;
                openExternal(uri);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                progress.setVisibility(View.VISIBLE);
                progress.setProgress(5);
            }
            @Override public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (!pageError && isOnline()) offlinePanel.setVisibility(View.GONE);
                if (authRedirecting && url.startsWith(BuildConfig.WEB_ORIGIN + "/dashboard")) {
                    webView.clearHistory();
                    authRedirecting = false;
                }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { pageError = true; offlinePanel.setVisibility(View.VISIBLE); }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) { progress.setProgress(value); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFile != null) pendingFile.onReceiveValue(null);
                pendingFile = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
                try { startActivityForResult(intent, PICK_DOCUMENT); }
                catch (ActivityNotFoundException e) { pendingFile.onReceiveValue(null); pendingFile = null; Toast.makeText(MainActivity.this, "No document picker is available", Toast.LENGTH_LONG).show(); }
                return true;
            }
        });
    }

    private boolean isInternal(Uri uri) {
        Uri site = Uri.parse(BuildConfig.WEB_ORIGIN);
        return "https".equals(uri.getScheme()) && site.getHost().equalsIgnoreCase(uri.getHost()) && site.getPort() == uri.getPort();
    }

    private void openExternal(Uri uri) {
        if (!"https".equals(uri.getScheme()) && !"mailto".equals(uri.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "No app can open this link", Toast.LENGTH_LONG).show(); }
    }

    public final class AuthBridge {
        @JavascriptInterface public void startGoogleSignIn() { runOnUiThread(MainActivity.this::startGoogleSignIn); }
    }

    private void startGoogleSignIn() {
        try {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            String verifier = Base64.encodeToString(random, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            String challenge = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8)), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            getPreferences(MODE_PRIVATE).edit().putString(VERIFIER_KEY, verifier).putLong(VERIFIER_TIME_KEY, System.currentTimeMillis()).apply();
            openExternal(Uri.parse(BuildConfig.WEB_ORIGIN + "/api/auth/google/mobile?challenge=" + challenge));
        } catch (Exception e) { Toast.makeText(this, "Could not start Google sign-in", Toast.LENGTH_LONG).show(); }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.getData() != null) {
            handleDeepLink(intent);
            return;
        }
        String destination = widgetDestination(intent);
        if (destination != null) confirmIfAnswerPresent(() -> webView.loadUrl(BuildConfig.WEB_ORIGIN + destination));
    }

    private String widgetDestination(Intent intent) {
        if (intent == null) return null;
        String questionId = intent.getStringExtra(EXTRA_WIDGET_QUESTION_ID);
        if (questionId != null && questionId.matches("[A-Fa-f0-9]{24}"))
            return "/sessions/today?questionId=" + Uri.encode(questionId);
        String destination = intent.getStringExtra(EXTRA_WIDGET_DESTINATION);
        if ("/dashboard".equals(destination) || "/sessions/today".equals(destination)) return destination;
        return null;
    }

    private void handleDeepLink(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"jobprep".equals(data.getScheme()) || !"auth".equals(data.getHost())) return;
        String code = data.getQueryParameter("code");
        String verifier = getPreferences(MODE_PRIVATE).getString(VERIFIER_KEY, "");
        long started = getPreferences(MODE_PRIVATE).getLong(VERIFIER_TIME_KEY, 0L);
        getPreferences(MODE_PRIVATE).edit().remove(VERIFIER_KEY).remove(VERIFIER_TIME_KEY).apply();
        if (code == null || !code.matches("[A-Za-z0-9_-]{43}") || verifier.length() != 43 || System.currentTimeMillis() - started > 10 * 60_000L) {
            Toast.makeText(this, "Sign-in expired. Please try again.", Toast.LENGTH_LONG).show();
            return;
        }
        pageError = false;
        authRedirecting = true;
        webView.loadUrl(BuildConfig.WEB_ORIGIN + "/mobile-auth#code=" + Uri.encode(code) + "&verifier=" + Uri.encode(verifier));
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_DOCUMENT || pendingFile == null) return;
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        pendingFile.onReceiveValue(uri == null ? null : new Uri[]{uri});
        pendingFile = null;
    }

    private boolean isOnline() {
        Network active = connectivity.getActiveNetwork();
        NetworkCapabilities caps = active == null ? null : connectivity.getNetworkCapabilities(active);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void onNetworkChanged() {
        if (!isOnline()) offlinePanel.setVisibility(View.VISIBLE);
        else if (pageError) retryPage();
        else offlinePanel.setVisibility(View.GONE);
    }

    private void retryPage() {
        if (!isOnline()) { offlinePanel.setVisibility(View.VISIBLE); return; }
        pageError = false;
        offlinePanel.setVisibility(View.GONE);
        webView.reload();
    }

    private void confirmIfAnswerPresent(Runnable action) {
        webView.evaluateJavascript("Array.from(document.querySelectorAll('textarea')).some(e => e.value && e.value.trim().length > 0)", value -> {
            if ("true".equals(value)) new AlertDialog.Builder(this)
                .setTitle("Leave this screen?").setMessage("Text you have not submitted may be lost.")
                .setNegativeButton("Stay", null).setPositiveButton("Leave", (dialog, which) -> action.run()).show();
            else action.run();
        });
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) confirmIfAnswerPresent(() -> webView.goBack());
        else new AlertDialog.Builder(this).setTitle("Leave JobPrep?").setMessage("Your current unsaved answer may be lost.")
            .setNegativeButton("Stay", null).setPositiveButton("Leave", (dialog, which) -> finish()).show();
    }

    @Override protected void onSaveInstanceState(Bundle state) { webView.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); webView.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); webView.onResume(); QuestionOfDayWidgetProvider.refreshAll(this); }
    @Override protected void onDestroy() {
        if (networkCallback != null) connectivity.unregisterNetworkCallback(networkCallback);
        if (pendingFile != null) pendingFile.onReceiveValue(null);
        webArea.removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
