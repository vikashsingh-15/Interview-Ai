# JobPrep Android

JobPrep is a native Android 14+ application (minSdk 34, targetSdk 35). Its Activity supplies bottom navigation, Android back and exit handling, PDF/DOCX system document selection, safe area and keyboard handling, offline retry, lifecycle state, and browser handling for external links. It includes resizable Dashboard, Practice, and dynamic Today’s Question home-screen widgets. The existing HTTPS Vercel frontend runs as the main WebView content and continues to use its same-origin /api proxy, Express backend, MongoDB data, Google account, and AI services. The current Next.js frontend has server-rendered dynamic routes and a server API route, so its build output cannot be copied directly into an APK.

## Home-screen widgets

Add JobPrep Dashboard, JobPrep Practice, or Today’s Question from your Android launcher’s Widgets picker. All three resize horizontally and vertically. Dashboard opens `/dashboard`; Practice opens `/sessions/today`. Today’s Question loads the signed-in user’s current session, lets you browse questions with Previous and Next, and opens the selected question in the app. It refreshes when the app resumes and has a refresh control. Install app version 1.2.0 or newer to add the question widget.

## Mobile Google sign-in

Google OAuth cannot run inside an embedded WebView. JobPrep opens the existing /api/auth/google/mobile flow in the Android system browser. The server verifies Google exactly as it does for the website, then redirects a two-minute one-time handoff code to jobprep://auth. The app holds a private PKCE verifier, opens /mobile-auth on the website origin, and redeems the code there. The existing HttpOnly session cookie is then set on that origin. No Google client secret, AI key, database credential, or session token is stored in the APK.

The website's normal /api/auth/google flow is unchanged. The mobile code adds a short-lived MobileHandoff collection with a TTL index to the existing MongoDB database; it creates no second account or data store.

## Prerequisites

1. Deploy the frontend and backend code containing /mobile-auth, /api/auth/google/mobile, and /api/auth/mobile/exchange to the existing Vercel and Render services. The deployment settings and environment variable names do not change. Until both code deployments are live, an installed APK can open the site but its Google sign-in handoff cannot complete.
2. Install JDK 17 or newer, Android Studio, Android SDK Platform 35, and Android SDK Build Tools 34.0.0. Gradle 8.9 is supplied by the checked-in wrapper.
3. Before public distribution, replace the placeholder package com.jobprep.mobile in app/build.gradle, the Java package/path, and the corresponding signing identity with the owner's unique package ID. Keep the jobprep deep-link scheme aligned with the server's mobile callback.

## Local configuration

Create mobile/local.properties (ignored by Git):

    sdk.dir=C:/Users/YOU/AppData/Local/Android/Sdk
    jobprepOrigin=https://YOUR-VERCEL-DOMAIN

jobprepOrigin is a public website origin. It must be HTTPS with no path, credentials, query, or fragment. You can instead pass -PjobprepOrigin=https://YOUR-VERCEL-DOMAIN or set JOBPREP_WEB_ORIGIN. The website's private .env is not edited or packaged.

Create a release keystore outside source control, then add mobile/signing.properties (also ignored):

    storeFile=.local-signing/jobprep-release.jks
    storePassword=YOUR_PRIVATE_STORE_PASSWORD
    keyAlias=jobprep
    keyPassword=YOUR_PRIVATE_KEY_PASSWORD

Keep the keystore and passwords backed up privately. Losing this key prevents updates under the same Android package ID. A local signing key and properties file have already been generated in this workspace and are ignored by Git.

## Build and install on Windows PowerShell

    cd 'E:\DEVELOPMENT\WEBDEV\Interview Ai\interview-prep\mobile'
    .\gradlew.bat assembleRelease
    & "$env:LOCALAPPDATA\Android\Sdk\build-tools\34.0.0\apksigner.bat" verify --verbose '.\app\build\outputs\apk\release\app-release.apk'
    & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r '.\app\build\outputs\apk\release\app-release.apk'

Open JobPrep on a physical Android 14+ device. The APK path is mobile/app/build/outputs/apk/release/app-release.apk.

On this restricted execution host, Gradle used a workspace-local copy of SDK 35 and its cached Gradle 8.9 distribution. The signed APK built with -x lintVitalRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease because the offline cache lacks com.android.tools.lint:lint-gradle:31.7.3. A normal connected release build should run without those exclusions so vital lint executes.

## Validation checklist on a device

- Install, launch, sign in with Google through the system browser, return to JobPrep, reload, and sign out.
- Open Dashboard, Practice, History, Settings, Projects, Topics, Search, Mock Interview, and Onboarding.
- Upload PDF and DOCX resumes using the system document picker; verify parsing and history on the website.
- Generate questions, submit answers, and confirm results persist across app background/resume and website reload.
- Check back navigation, keyboard scrolling, external links, offline message and retry in portrait on Android 14+.

No device or emulator installation was verified in this workspace. The app requires the production frontend/backend code deployment before the new sign-in flow can be exercised end to end.
