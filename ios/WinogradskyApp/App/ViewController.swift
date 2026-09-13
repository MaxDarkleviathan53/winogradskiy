import UIKit
import WebKit
import CoreLocation
import LocalAuthentication
import Photos

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {

    private var webView: WKWebView!
    private var locationManager: CLLocationManager?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupLocationManager()
        setupWebView()
        loadWebContent()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    // MARK: - Location Setup

    private func setupLocationManager() {
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest
        locationManager?.requestWhenInUseAuthorization()
    }

    // MARK: - WebView Setup

    private func setupWebView() {
        let contentController = WKUserContentController()

        // Bridge handlers
        contentController.add(self, name: "saveImageToGallery")
        contentController.add(self, name: "authenticateBiometrics")

        // Inject compatibility script for AndroidGallery & AndroidBiometrics
        let bridgeScriptSource = """
        (function() {
            window.AndroidGallery = {
                saveImageToGallery: function(base64Data, filename) {
                    try {
                        window.webkit.messageHandlers.saveImageToGallery.postMessage({
                            data: base64Data,
                            filename: filename || 'quest_poster.jpg'
                        });
                        return true;
                    } catch(e) {
                        console.error('iOS Gallery bridge error:', e);
                        return false;
                    }
                }
            };

            window.AndroidBiometrics = {
                isBiometricAvailable: function() {
                    return true;
                },
                authenticate: function() {
                    try {
                        window.webkit.messageHandlers.authenticateBiometrics.postMessage({});
                    } catch(e) {
                        console.error('iOS Biometrics bridge error:', e);
                    }
                }
            };
            console.log('iOS Native Bridge initialized successfully');
        })();
        """
        let bridgeScript = WKUserScript(source: bridgeScriptSource, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        contentController.addUserScript(bridgeScript)

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        
        let prefs = WKPreferences()
        prefs.javaScriptEnabled = true
        config.preferences = prefs

        // Enable universal local file access
        config.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(red: 0.10, green: 0.20, blue: 0.15, alpha: 1.0)
        webView.isOpaque = false

        view.addSubview(webView)
    }

    // MARK: - Load Content

    private func loadWebContent() {
        if let bundleUrl = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            let wwwDir = bundleUrl.deletingLastPathComponent()
            webView.loadFileURL(bundleUrl, allowingReadAccessTo: wwwDir)
        } else {
            // Fallback: search main bundle root
            if let indexUrl = Bundle.main.url(forResource: "index", withExtension: "html") {
                let baseDir = indexUrl.deletingLastPathComponent()
                webView.loadFileURL(indexUrl, allowingReadAccessTo: baseDir)
            } else {
                print("Error: index.html not found in app bundle")
            }
        }
    }

    // MARK: - Script Message Handler (JS -> Swift)

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "saveImageToGallery" {
            handleSaveImage(message.body)
        } else if message.name == "authenticateBiometrics" {
            handleBiometrics()
        }
    }

    private func handleSaveImage(_ body: Any) {
        guard let dict = body as? [String: Any],
              let base64String = dict["data"] as? String else {
            return
        }

        var cleanString = base64String
        if let commaIndex = cleanString.firstIndex(of: ",") {
            cleanString = String(cleanString[cleanString.index(after: commaIndex)...])
        }

        guard let data = Data(base64Encoded: cleanString, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            return
        }

        UIImageWriteToSavedPhotosAlbum(image, self, #selector(image(_:didFinishSavingWithError:contextInfo:)), nil)
    }

    @objc private func image(_ image: UIImage, didFinishSavingWithError error: Error?, contextInfo: UnsafeRawPointer) {
        DispatchQueue.main.async {
            if let error = error {
                self.webView.evaluateJavaScript("alert('Не вдалося зберегти афішу: \(error.localizedDescription)');", completionHandler: nil)
            } else {
                self.webView.evaluateJavaScript("if (typeof showToast === 'function') { showToast('Афішу успішно збережено у Фотографії!'); }", completionHandler: nil)
            }
        }
    }

    private func handleBiometrics() {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            let reason = "Авторизація через Face ID / Touch ID"
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { [weak self] success, evalError in
                DispatchQueue.main.async {
                    if success {
                        self?.webView.evaluateJavaScript("if (window.onBiometricSuccess) { window.onBiometricSuccess(); }", completionHandler: nil)
                    } else {
                        let errMsg = evalError?.localizedDescription ?? "Авторизацію скасовано"
                        self?.webView.evaluateJavaScript("if (window.onBiometricError) { window.onBiometricError('\(errMsg)'); }", completionHandler: nil)
                    }
                }
            }
        } else {
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("if (window.onBiometricError) { window.onBiometricError('Біометрія недоступна'); }", completionHandler: nil)
            }
        }
    }

    // MARK: - WKUIDelegate (Camera & Permissions)

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Winogradsky", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler() }))
        present(alert, animated: true, completion: nil)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Winogradsky", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default, handler: { _ in completionHandler(true) }))
        alert.addAction(UIAlertAction(title: "Скасувати", style: .cancel, handler: { _ in completionHandler(false) }))
        present(alert, animated: true, completion: nil)
    }
}
