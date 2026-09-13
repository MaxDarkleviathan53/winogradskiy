# Winogradsky Institute — iOS Додаток

Цей каталог містить повноцінний нативний iOS-проект для Apple iPhone та iPad, створений на мові **Swift** з використанням рушія **WebKit (WKWebView)**.

---

## 1. Архітектура проекту

- **`WinogradskyApp/App/ViewController.swift`**:
  - Налаштовує повноекранний `WKWebView` з апаратною оптимізацією.
  - Надає доступ до Камери для розпізнавання QR-кодів та квесту (WebRTC).
  - Підключає геолокацію (`CoreLocation`) для живої навігації картою Leaflet.
  - Реалізує нативний місток для збереження згенерованої історичної афіші в альбом **«Фотографії»** iPhone (`Photos`).
  - Підтримує швидку авторизацію через **Face ID / Touch ID** (`LocalAuthentication`).
- **`WinogradskyApp/Resources/Info.plist`**:
  - Офіційні дозволи конфіденційності Apple (`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSFaceIDUsageDescription`).
  - Дозвіл на мережеві запити до сервера `http://94.247.230.221:5000` (ATS).
- **`WinogradskyApp/www/`**:
  - Локальні веб-ресурси додатку (`index.html`, `app.js`, `styles.css`, аудіогіди, шрифти, графіка).
- **`WinogradskyApp.xcodeproj`**:
  - Повноцінний проект Xcode зі схемою збирання `WinogradskyApp`.

---

## 2. Як скомпілювати `.ipa` через GitHub Actions (з комп'ютера Windows)

1. Закомітьте всі файли та надішліть їх у свій репозиторій на GitHub:
   ```bash
   git add .
   git commit -m "Add iOS project and GitHub Actions workflow"
   git push origin main
   ```
2. Відкрийте ваш репозиторій на сайті **GitHub** у браузері.
3. Перейдіть на вкладку **Actions**.
4. Ви побачите процес збірки **`Build iOS App (.ipa)`**. Він запуститься автоматично на хмарному комп'ютері Apple macOS.
5. Після завершення збірки (зазвичай 2-4 хвилини) відкрийте збірку та в розділі **Artifacts** завантажте файл **`WinogradskyApp-iOS-Build`** (всередині буде готовий файл **`WinogradskyApp.ipa`**).

---

## 3. Як встановити `.ipa` на реальний iPhone з Windows

1. Завантажте безкоштовну програму для Windows — **[Sideloadly](https://sideloadly.io/)** (або **AltStore**).
2. Підключіть iPhone до комп'ютера через кабель USB.
3. Перетягніть файл `WinogradskyApp.ipa` у вікно Sideloadly.
4. Введіть свій звичайний Apple ID (це потрібно для генерації персонального безкоштовного підпису розробника від Apple).
5. Натисніть **Start**. Програма підпише додаток і встановить його на ваш iPhone.
6. На телефоні відкрийте: **Параметри -> Загальні -> VPN і керування пристроєм**, виберіть ваш Apple ID та натисніть **«Довіряти»**.
7. Додаток готовий до роботи на iPhone!

---

## 4. Відкриття у Xcode (якщо є комп'ютер Mac)

Просто відкрийте файл `WinogradskyApp.xcodeproj` у програмі Xcode на macOS та натисніть **Run** (Cmd + R).
