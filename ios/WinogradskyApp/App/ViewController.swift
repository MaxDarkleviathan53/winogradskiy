import UIKit
import WebKit
import CoreLocation
import LocalAuthentication
import Photos

class ViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {

    private var webView: WKWebView!
    private var locationManager: CLLocationManager?
    private var locationRequestedByJS = false
    private var latestHeading: Double = -1.0

    override func viewDidLoad() {
        super.viewDidLoad()
        setupLocationManager()
        setupWebView()
        loadWebContent()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        if #available(iOS 13.0, *) {
            return .darkContent
        } else {
            return .default
        }
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .pad {
            return .all
        }
        return .allButUpsideDown
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        coordinator.animate(alongsideTransition: { _ in
            self.view.layoutIfNeeded()
        }, completion: { _ in
            self.webView?.evaluateJavaScript("window.dispatchEvent(new Event('resize'));", completionHandler: nil)
        })
    }

    // MARK: - Location Setup

    private func setupLocationManager() {
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.desiredAccuracy = kCLLocationAccuracyBest
        locationManager?.distanceFilter = 2.0
    }

    // MARK: - WebView Setup

    private func setupWebView() {
        let contentController = WKUserContentController()

        // Bridge handlers
        contentController.add(self, name: "saveImageToGallery")
        contentController.add(self, name: "authenticateBiometrics")
        contentController.add(self, name: "nativeLocation")

        // Inject compatibility script for AndroidGallery, AndroidBiometrics & Native Geolocation
        let bridgeScriptSource = """
        (function() {
            try {
                document.documentElement.classList.add('is-ios');
            } catch(e) {}

            var watchCallbacks = {};
            var oneShotCallbacks = [];
            var nextWatchId = 1;
            var lastKnownPosition = null;

            window.__onNativeLocationUpdate = function(lat, lng, accuracy, heading) {
                var pos = {
                    coords: {
                        latitude: lat,
                        longitude: lng,
                        accuracy: accuracy || 10,
                        altitude: null,
                        altitudeAccuracy: null,
                        heading: (typeof heading === 'number' && heading >= 0) ? heading : null,
                        speed: null
                    },
                    timestamp: Date.now()
                };
                lastKnownPosition = pos;

                while (oneShotCallbacks.length > 0) {
                    var cb = oneShotCallbacks.shift();
                    try { if (cb && typeof cb.success === 'function') cb.success(pos); } catch (e) {}
                }

                Object.keys(watchCallbacks).forEach(function(id) {
                    var w = watchCallbacks[id];
                    try { if (w && typeof w.success === 'function') w.success(pos); } catch (e) {}
                });
            };

            window.__onNativeLocationError = function(code, message) {
                var err = { code: code || 1, message: message || 'Location permission denied' };
                while (oneShotCallbacks.length > 0) {
                    var cb = oneShotCallbacks.shift();
                    try { if (cb && typeof cb.error === 'function') cb.error(err); } catch (e) {}
                }
                Object.keys(watchCallbacks).forEach(function(id) {
                    var w = watchCallbacks[id];
                    try { if (w && typeof w.error === 'function') w.error(err); } catch (e) {}
                });
            };

            var nativeGeolocation = {
                getCurrentPosition: function(success, error, options) {
                    if (lastKnownPosition && (Date.now() - lastKnownPosition.timestamp < 15000)) {
                        var cachedPos = lastKnownPosition;
                        setTimeout(function() {
                            try { if (typeof success === 'function') success(cachedPos); } catch (e) {}
                        }, 0);
                    } else {
                        oneShotCallbacks.push({ success: success, error: error });
                    }
                    try {
                        window.webkit.messageHandlers.nativeLocation.postMessage({ action: 'request' });
                    } catch (e) {
                        if (typeof error === 'function') error({ code: 2, message: 'Location bridge error' });
                    }
                },
                watchPosition: function(success, error, options) {
                    var id = nextWatchId++;
                    watchCallbacks[id] = { success: success, error: error };
                    if (lastKnownPosition) {
                        var cachedPos = lastKnownPosition;
                        setTimeout(function() {
                            if (watchCallbacks[id] && typeof watchCallbacks[id].success === 'function') {
                                try { watchCallbacks[id].success(cachedPos); } catch (e) {}
                            }
                        }, 0);
                    }
                    try {
                        window.webkit.messageHandlers.nativeLocation.postMessage({ action: 'watch' });
                    } catch (e) {}
                    return id;
                },
                clearWatch: function(id) {
                    delete watchCallbacks[id];
                    if (Object.keys(watchCallbacks).length === 0) {
                        try {
                            window.webkit.messageHandlers.nativeLocation.postMessage({ action: 'stop' });
                        } catch (e) {}
                    }
                }
            };

            try {
                Object.defineProperty(navigator, 'geolocation', {
                    get: function() { return nativeGeolocation; },
                    configurable: true
                });
            } catch (e) {
                try { navigator.geolocation = nativeGeolocation; } catch (err) {}
            }

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

        view.backgroundColor = UIColor(red: 0.965, green: 0.973, blue: 0.961, alpha: 1.0)

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(red: 0.965, green: 0.973, blue: 0.961, alpha: 1.0)
        webView.isOpaque = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
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
        } else if message.name == "nativeLocation" {
            handleNativeLocation(message.body)
        }
    }

    // MARK: - Native Location Bridge (CLLocationManager)

    private func currentLocationAuthStatus() -> CLAuthorizationStatus {
        if #available(iOS 14.0, *) {
            return locationManager?.authorizationStatus ?? .notDetermined
        } else {
            return CLLocationManager.authorizationStatus()
        }
    }

    private func handleNativeLocation(_ body: Any) {
        guard let dict = body as? [String: Any],
              let action = dict["action"] as? String else {
            return
        }

        if action == "stop" {
            locationRequestedByJS = false
            locationManager?.stopUpdatingLocation()
            locationManager?.stopUpdatingHeading()
            return
        }

        locationRequestedByJS = true
        let status = currentLocationAuthStatus()

        switch status {
        case .notDetermined:
            locationManager?.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager?.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager?.startUpdatingHeading()
            }
            if let loc = locationManager?.location {
                sendLocationToJS(loc)
            }
        case .denied, .restricted:
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("if (window.__onNativeLocationError) { window.__onNativeLocationError(1, 'Location permission denied'); }", completionHandler: nil)
            }
        @unknown default:
            break
        }
    }

    @available(iOS 14.0, *)
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthorizationChange(manager.authorizationStatus)
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        handleAuthorizationChange(status)
    }

    private func handleAuthorizationChange(_ status: CLAuthorizationStatus) {
        guard locationRequestedByJS else { return }
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager?.startUpdatingLocation()
            if CLLocationManager.headingAvailable() {
                locationManager?.startUpdatingHeading()
            }
            if let loc = locationManager?.location {
                sendLocationToJS(loc)
            }
        case .denied, .restricted:
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("if (window.__onNativeLocationError) { window.__onNativeLocationError(1, 'Location permission denied'); }", completionHandler: nil)
            }
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        sendLocationToJS(loc)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        if newHeading.trueHeading >= 0 {
            latestHeading = newHeading.trueHeading
        } else if newHeading.magneticHeading >= 0 {
            latestHeading = newHeading.magneticHeading
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clErr = error as? CLError, clErr.code == .denied {
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("if (window.__onNativeLocationError) { window.__onNativeLocationError(1, 'Location permission denied'); }", completionHandler: nil)
            }
        }
    }

    private func sendLocationToJS(_ loc: CLLocation) {
        let lat = loc.coordinate.latitude
        let lng = loc.coordinate.longitude
        let acc = max(loc.horizontalAccuracy, 5.0)
        let heading = latestHeading >= 0 ? latestHeading : (loc.course >= 0 ? loc.course : -1.0)
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript("if (window.__onNativeLocationUpdate) { window.__onNativeLocationUpdate(\(lat), \(lng), \(acc), \(heading)); }", completionHandler: nil)
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

    // MARK: - WKNavigationDelegate (External Links)

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url,
           let scheme = url.scheme?.lowercased(),
           (scheme == "http" || scheme == "https") {
            if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    // MARK: - WKUIDelegate (Camera & Permissions)

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        return nil
    }

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
