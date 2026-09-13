package com.winogradsky.app;

import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.GeolocationPermissions;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.io.OutputStream;
import java.util.concurrent.Executor;

public class MainActivity extends AppCompatActivity {

    private WebView myWebView;
    private Executor executor;
    private BiometricPrompt biometricPrompt;
    private BiometricPrompt.PromptInfo promptInfo;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        myWebView = findViewById(R.id.webview);
        
        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setGeolocationEnabled(true);
        webSettings.setGeolocationDatabasePath(getFilesDir().getPath());
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        
        // Ensure links are opened inside the WebView, not external browser
        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return false; // let WebView load the url
            }
        });

        // Enable Geolocation & Camera prompt handling in WebView
        myWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    request.grant(request.getResources());
                });
            }
        });

        // Request Location and Camera runtime permissions
        String[] permissions = new String[]{
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION,
                android.Manifest.permission.CAMERA
        };

        boolean needsPermission = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                needsPermission = true;
                break;
            }
        }

        if (needsPermission) {
            androidx.core.app.ActivityCompat.requestPermissions(this, permissions, 1);
        }

        // Add Javascript Interfaces
        executor = ContextCompat.getMainExecutor(this);
        myWebView.addJavascriptInterface(new BiometricInterface(), "AndroidBiometrics");
        myWebView.addJavascriptInterface(new GalleryInterface(), "AndroidGallery");

        // Load the local HTML file from assets folder
        myWebView.loadUrl("file:///android_asset/index.html");
    }

    public class GalleryInterface {
        @JavascriptInterface
        public boolean saveImageToGallery(String base64Data, String filename) {
            try {
                if (base64Data == null || base64Data.isEmpty()) return false;
                
                // Strip data URL prefix if present
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }

                byte[] imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                String safeName = (filename != null && !filename.isEmpty()) ? filename : "quest_photo_" + System.currentTimeMillis();
                if (!safeName.endsWith(".jpg") && !safeName.endsWith(".jpeg")) {
                    safeName += ".jpg";
                }

                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/WinogradskyQuest");
                    values.put(MediaStore.Images.Media.IS_PENDING, 1);
                }

                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out != null) {
                            out.write(imageBytes);
                            out.flush();
                        }
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        values.clear();
                        values.put(MediaStore.Images.Media.IS_PENDING, 0);
                        getContentResolver().update(uri, values, null, null);
                    }
                    return true;
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return false;
        }
    }

    public class BiometricInterface {
        @JavascriptInterface
        public boolean isBiometricAvailable() {
            BiometricManager biometricManager = BiometricManager.from(MainActivity.this);
            int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
            return biometricManager.canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS;
        }

        @JavascriptInterface
        public void authenticate() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    biometricPrompt = new BiometricPrompt(MainActivity.this, executor, new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            myWebView.post(new Runnable() {
                                @Override
                                public void run() {
                                    myWebView.loadUrl("javascript:window.onBiometricError('" + errString.toString() + "')");
                                }
                            });
                        }

                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            myWebView.post(new Runnable() {
                                @Override
                                public void run() {
                                    myWebView.loadUrl("javascript:window.onBiometricSuccess()");
                                }
                            });
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                            myWebView.post(new Runnable() {
                                @Override
                                public void run() {
                                    myWebView.loadUrl("javascript:window.onBiometricFailed()");
                                }
                            });
                        }
                    });

                    promptInfo = new BiometricPrompt.PromptInfo.Builder()
                            .setTitle("Авторизація")
                            .setSubtitle("Підтвердіть особу за допомогою біометрії")
                            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                            .build();

                    biometricPrompt.authenticate(promptInfo);
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        // Allow navigating back inside WebView history if possible
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
