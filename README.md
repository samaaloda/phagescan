# PhageScan

Software for analyzing 96-well phage susceptibility plates from mobile photos. PhageScan combines a React Native mobile app, a FastAPI inference server, and ML tooling for well segmentation and classification.

## Contents

- [Overview](#overview)
- [Repo Contents](#repo-contents)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Demo](#demo)
- [Instructions for Use](#instructions-for-use)
- [License](#license)
- [Issues](#issues)

## Overview

PhageScan helps researchers photograph well plates, send images to a classification API, and view per-well results on an 8×12 grid (A1–H12). The pipeline:

1. **Segment** wells from a plate photo using circle detection (OpenCV Hough transform).
2. **Classify** each well as *Effective*, *Somewhat Effective*, or *Ineffective* using a CNN model, a multiclass CNN, or an RGB rule-based classifier.
3. **Display** results in the mobile app and optionally save them to Firebase.

The repository includes source code for all three components, pretrained model weights, and a demo plate image with segmented wells for testing.

## Repo Contents

| Directory | Description |
|-----------|-------------|
| [`app/`](./app/) | React Native (Expo) mobile application — capture/upload plates, call API, view results |
| [`api/`](./api/) | FastAPI server — image upload, segmentation, classification |
| [`ml/`](./ml/) | Standalone ML scripts — segmentation, RGB/CNN evaluation, Random Forest training |
| [`demo/`](./demo/) | Additional demo assets |

Each subdirectory has its own README with component-specific install, demo, and usage instructions.

## System Requirements

### Hardware Requirements

PhageScan runs on a standard desktop or laptop for the API and ML components, and on iOS/Android devices (or simulators) for the mobile app.

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| API / ML server | 4 GB RAM, 2 CPU cores | 8+ GB RAM, 4+ CPU cores @ 3+ GHz |
| Mobile app | iOS 15+ or Android 10+ device/simulator | Physical device on same Wi‑Fi as dev machine |

No special hardware (GPU, custom sensors) is required. TensorFlow runs on CPU.

### Software Requirements

| Component | Requirements |
|-----------|--------------|
| **API** | Python 3.11, conda or venv recommended |
| **ML** | Python 3.11 |
| **App** | Node.js 18+, npm, Expo CLI (via `npx expo`) |

**Tested on:**

- macOS 14+ (Apple Silicon and Intel)
- iOS Simulator (iOS 18) via Expo Go
- Python 3.11 with conda environment `phagescan-api`

See subdirectory READMEs for full dependency lists and version pins.

## Installation Guide

Install each component you plan to use. Typical total setup time on a recommended machine: **10–20 minutes** (mostly `pip install tensorflow` and `npm install`).

### 1. API (required for local development)

```bash
cd api
conda create -n phagescan-api python=3.11 -y
conda activate phagescan-api
pip install -r requirements.txt
```

Install time: ~3–8 minutes (TensorFlow is the largest dependency).

### 2. Mobile app

```bash
cd app
npm install
```

Install time: ~30–60 seconds.

### 3. ML scripts (optional, for offline evaluation)

```bash
cd ml
pip install -r requirements.txt
```

Install time: ~1–2 minutes.

## Demo

### Quick demo: API only (~10 seconds)

With the API running:

```bash
cd api
conda activate phagescan-api
uvicorn main:app --host 0.0.0.0 --port 8000
```

In a second terminal:

```bash
curl -X POST "http://127.0.0.1:8000/process/" \
  -F "file=@demo/test_image.jpeg" \
  -F "model_type=binary"
```

**Expected output:** JSON with a `results` array. Each entry has `x`, `y`, `r`, `row`, `column`, and `Predicted` (e.g. `"Effective"` or `"Ineffective"`). A full plate typically returns up to 96 wells.

**Expected runtime:** ~5–15 seconds on a recommended machine (segmentation + CNN inference).

### Full demo: app + API

1. Start the API (see above).
2. Start the app:

   ```bash
   cd app
   npm start
   ```

3. Open Expo Go on your phone (same Wi‑Fi as your computer) or use the iOS/Android simulator.
4. Go to the **Scanner** tab, upload or capture a plate photo, and tap **Analyze Image**.

**Expected output:** An analysis modal with an 8×12 well grid colored by classification.

See [`api/README.md`](./api/README.md), [`app/README.md`](./app/README.md), and [`ml/README.md`](./ml/README.md) for component-specific demos.

## Instructions for Use

### Run on your own plate images

**Via API (curl or any HTTP client):**

```bash
curl -X POST "http://YOUR_API_HOST:8000/process/" \
  -F "file=@/path/to/your_plate.jpg" \
  -F "model_type=binary"
```

`model_type` options:

| Value | Description |
|-------|-------------|
| `binary` | 2-class CNN (Effective / Ineffective) — default |
| `multiclass` | 4-class CNN (Effective / Ineffective / Somewhat Effective / Unknown) |
| `rule` | RGB distance rule (Effective / Somewhat Effective / Ineffective) |

**Via mobile app:**

1. Ensure the API is reachable from your device (see [`app/README.md`](./app/README.md) for local dev networking).
2. Capture or upload a well plate photo in the Scanner tab.
3. Choose **Analyze Image (Binary)** or **Analyze Image (Multi-Class)**.
4. Review results and optionally **Save Plate** to Firebase.

**Via ML scripts (offline):**

```bash
cd ml
python segmentation.py          # segment demo plate → demo/segmented_wells/
python rgb_classifier.py        # classify segmented wells → data/classification_results.csv
python evaluate.py              # compare to ground truth → data/merged_results_with_accuracy.csv
```

### Reproducing quantitative results

To reproduce evaluation metrics in `ml/data/`:

```bash
cd ml
python rgb_classifier.py
python evaluate.py
python train_random_forest.py
```

Ground-truth labels are in `ml/data/ground_truth_labels.csv`. Merged accuracy output is written to `ml/data/merged_results_with_accuracy.csv`.

## License

MIT

## Issues

Report bugs or request features via your repository's issue tracker.
