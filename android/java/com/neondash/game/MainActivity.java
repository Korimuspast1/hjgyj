package com.neondash.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Neon Dash — Android shell.
 *
 * A single fullscreen WebView hosting the HTML5 build from assets/www/.
 * The page talks back through the injected `AndroidBridge` object:
 *
 *     AndroidBridge.vibrate(ms)          — haptics (respects in-game setting)
 *     AndroidBridge.exitApp()            — finish the activity
 *     AndroidBridge.shareText(text, subj)— Android share sheet (level codes)
 *
 * and receives lifecycle / navigation callbacks as global JS functions the
 * game defines (game/js/boot.js):
 *
 *     window.onAndroidBack()   — hardware back button
 *     window.onAndroidPause()  — app moved to the background
 *     window.onAndroidResume() — app came back to the foreground
 */
public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // localStorage: progress & levels
        s.setAllowFileAccess(true);              // file:///android_asset (API 30+ default false)
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);                      // ignore system font scale
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // keep the game inside the WebView; open anything else externally
                return !(url.startsWith("file://") || url.startsWith("https://")
                        || url.startsWith("http://") || url.startsWith("data:"));
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");

        setContentView(webView);
        applyImmersive();

        if (savedInstanceState == null) {
            webView.loadUrl("file:///android_asset/www/index.html");
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    // ------------------------------------------------------------ immersion

    private void applyImmersive() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    // ---------------------------------------------------------- lifecycle

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.onAndroidPause && window.onAndroidPause()", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.evaluateJavascript("window.onAndroidResume && window.onAndroidResume()", null);
        }
        applyImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        // Let the game decide: close overlay > pause > leave screen > exit.
        if (webView != null) {
            webView.evaluateJavascript("window.onAndroidBack && window.onAndroidBack()", null);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------- JS bridge

    private class Bridge {

        @JavascriptInterface
        public void vibrate(long ms) {
            try {
                Vibrator v = vibrator();
                if (v == null) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms),
                            VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    @SuppressWarnings("deprecation")
                    Vibrator legacy = v;
                    legacy.vibrate(ms);
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    finish();
                }
            });
        }

        @JavascriptInterface
        public void shareText(final String text, final String subject) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType("text/plain");
                        send.putExtra(Intent.EXTRA_TEXT, text);
                        if (subject != null) send.putExtra(Intent.EXTRA_SUBJECT, subject);
                        startActivity(Intent.createChooser(send, subject != null ? subject : "Share"));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Sharing unavailable", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        @SuppressWarnings("deprecation")
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        return v;
    }
}
