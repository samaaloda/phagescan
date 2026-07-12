# PhageScan Mobile App

React Native (Expo) mobile application for capturing well plate photos, sending them to the PhageScan API, and viewing per-well classification results.

## Contents

- [Overview](#overview)
- [Repo Contents](#repo-contents)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Demo](#demo)
- [Instructions for Use](#instructions-for-use)
- [License](#license)

## Overview

The app lets researchers:

1. **Sign in** via Firebase Authentication.
2. **Capture or upload** a 96-well plate photo.
3. **Analyze** the image through the PhageScan API (binary or multi-class models).
4. **View** results on an interactive 8×12 grid (A1–H12).
5. **Save** analyzed plates to Firebase Firestore under experiments.

## Repo Contents

| Path | Description |
|------|-------------|
| `app/(tabs)/scanner.tsx` | Plate capture, API call, results display |
| `app/(tabs)/lab-work.tsx` | Experiment management |
| `app/(tabs)/profile.tsx` | User profile |
| `app/(tabs)/hub.tsx` | Shared experiments hub |
| `lib/firebaseConfig.ts` | Firebase initialization |
| `constants/api.ts` | API URL config (dev vs production) |
| `services/firebaseService.ts` | Firestore CRUD for experiments and plates |
| `components/WellPlateGrid.tsx` | 8×12 results grid component |
| `package.json` | Node dependencies and scripts |

## System Requirements

### Hardware

| | Minimum | Recommended |
|---|---------|-------------|
| Dev machine | 4 GB RAM | 8+ GB RAM |
| Target device | iOS 15+ or Android 10+ | Physical iPhone/Android on same Wi‑Fi as dev machine |

Camera access is required for the Scanner tab. No non-standard hardware is needed.

### Software

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Required for npm |
| npm | 9+ | Bundled with Node |
| Expo CLI | via `npx expo` | SDK 53 |
| Expo Go | Latest | For physical device testing |
| Xcode | 15+ | For iOS Simulator (macOS only) |
| Android Studio | Latest | For Android Emulator (optional) |

**Tested on:**

- macOS 14+ with iOS Simulator (iPhone 16 Plus, iOS 18)
- Expo SDK 53, React Native 0.79, React 19

**Key dependencies:**

```
expo ~53.0, expo-router ^5.1, firebase ^12.0,
@react-native-async-storage/async-storage ^1.24,
expo-image-picker ^16.1, react-native-reanimated ~3.17
```

The app also requires a running PhageScan API (local or deployed) and a configured Firebase project.

## Installation Guide

```bash
cd app
npm install
```

**Typical install time:** ~30–60 seconds.

### Firebase setup

Firebase config is in `lib/firebaseConfig.ts`. Replace with your own project credentials for a new deployment. The bundled config points to the `phagescan-5c4eb` Firebase project.

### API setup (local development)

The app auto-detects your dev machine IP in `constants/api.ts`:

- **Dev:** `http://<your-ip>:8000/process/`
- **Production:** `https://phagescan-api.onrender.com/process/`

Start the API before using the Scanner:

```bash
cd ../api
conda activate phagescan-api
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Demo

### Start the app

```bash
cd app
npm start
```

This launches the Expo dev server. Then:

- Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with **Expo Go** on your phone.

**Startup time:** ~5–15 seconds.

### Demo workflow

1. **Sign in** (or create an account on the login/sign-up screens).
2. Open the **Scanner** tab.
3. Tap **Choose from Library** and select a well plate photo, or tap **Take Photo**.
4. Tap **Analyze Image (Binary)** or **Analyze Image (Multi-Class)**.
5. Wait for the loading indicator (~5–15 seconds depending on API and network).
6. Review the **Analysis Results** modal with the colored 8×12 grid.

**Expected output:**

- Green wells = Effective
- Yellow wells = Somewhat Effective (multi-class / rule model only)
- Pink/red wells = Ineffective
- Grid spans rows A–H, columns 1–12

### Expected runtime

| Step | Time |
|------|------|
| App startup (Expo) | ~5–15 s |
| Image upload + API processing | ~5–15 s |
| Results display | Immediate |

## Instructions for Use

### Analyze your own plates

1. Ensure the API is running and reachable from your device (see [Networking](#networking) below).
2. Capture a photo with the plate filling as much of the frame as possible, wells clearly visible.
3. Use **Analyze Image (Binary)** for fast Effective/Ineffective results.
4. Use **Analyze Image (Multi-Class)** for RGB rule-based results including Somewhat Effective.
5. Tap **Save Plate** to store results in Firebase under an experiment.

### Save results to Firebase

After analysis, tap **Save Plate** in the results modal:

1. Select or create an experiment.
2. Enter a plate name and description.
3. Results are stored in Firestore with per-well coordinates and predictions.

### Networking

For local development, the phone must reach your computer's API:

| Platform | API host |
|----------|----------|
| Physical device (Expo Go) | `http://<your-computer-ip>:8000` (auto-detected) |
| iOS Simulator | `http://localhost:8000` |
| Android Emulator | `http://10.0.2.2:8000` |

Find your IP on macOS:

```bash
ipconfig getifaddr en0
```

The API must be started with `--host 0.0.0.0` and both devices must be on the same Wi‑Fi.

`app.json` includes `NSAllowsLocalNetworking` (iOS) and `usesCleartextTraffic` (Android) for local HTTP in development.

### Production builds

In production (`__DEV__ === false`), the app uses `https://phagescan-api.onrender.com`. Update `constants/api.ts` to point to your own deployment.

### Available scripts

```bash
npm start          # Start Expo dev server
npm run ios        # Start with iOS Simulator
npm run android    # Start with Android Emulator
npm run web        # Start web version (limited functionality)
```

## License

License to be specified. See the [root README](../README.md).
