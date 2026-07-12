# PhageScan API

FastAPI server that accepts well plate images, segments individual wells, and returns per-well classification results.

## Contents

- [Overview](#overview)
- [Repo Contents](#repo-contents)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Demo](#demo)
- [Instructions for Use](#instructions-for-use)
- [API Reference](#api-reference)
- [License](#license)

## Overview

The API exposes a single processing endpoint. Given a plate photo it:

1. Detects wells via OpenCV Hough circle detection.
2. Crops each well into `segmented_wells/<filename>/circle_<row>_<col>.png`.
3. Classifies each crop using the requested model.
4. Returns JSON with coordinates and predictions mapped to an 8×12 grid (rows 1–8, columns 1–12 → A1–H12).

## Repo Contents

| Path | Description |
|------|-------------|
| `main.py` | FastAPI app and `/process/` endpoint |
| `segmentations_utils.py` | Circle detection and well cropping |
| `classification_utils.py` | CNN and RGB rule-based classifiers |
| `models/` | Pretrained Keras weights (`.h5`) |
| `demo/test_image.jpeg` | Demo plate image for testing |
| `test_api.py` | Pytest suite for the API |
| `requirements.txt` | Python dependencies |

## System Requirements

### Hardware

| | Minimum | Recommended |
|---|---------|-------------|
| RAM | 4 GB | 8+ GB |
| CPU | 2 cores | 4+ cores @ 3+ GHz |

First request loads TensorFlow models into memory (~50–100 MB per model). No GPU required.

### Software

- **Python** 3.11 (tested with conda env `phagescan-api`)
- **OS:** macOS 14+, Linux (Ubuntu 22.04+), Windows (WSL recommended)

**Dependencies** (from `requirements.txt`):

```
fastapi, uvicorn, python-multipart, opencv-python-headless,
tensorflow, numpy, pillow, pillow-heif, pytest, httpx
```

TensorFlow 2.21+ is the largest install. All other packages install in under a minute.

## Installation Guide

```bash
cd api

# Option A: conda (recommended)
conda create -n phagescan-api python=3.11 -y
conda activate phagescan-api
pip install -r requirements.txt

# Option B: venv
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Typical install time:** 3–8 minutes on a recommended machine (dominated by TensorFlow download).

## Demo

### Start the server

```bash
conda activate phagescan-api
uvicorn main:app --host 0.0.0.0 --port 8000
```

Server startup: ~2–5 seconds (model loading is lazy, on first `/process/` request).

### Send the demo image

```bash
curl -X POST "http://127.0.0.1:8000/process/" \
  -F "file=@demo/test_image.jpeg" \
  -F "model_type=binary"
```

### Expected output

```json
{
  "results": [
    {
      "x": 1412,
      "y": 1011,
      "r": 69,
      "row": 1,
      "column": 1,
      "Predicted": "Effective"
    },
    ...
  ]
}
```

- `row` / `column`: 1-indexed grid position (row 1 = A, column 1 = col 1).
- `Predicted`: classification label for that well.
- A complete plate returns up to 96 results.

**Expected runtime:** ~5–15 seconds for the demo image on a recommended machine.

### Run automated tests

Requires the server to be running on port 8000:

```bash
pytest test_api.py -v
```

Tests cover `GET /` and `POST /process/` with `binary`, `rule`, and `multiclass` model types.

**Expected runtime:** ~30–60 seconds (three model runs).

## Instructions for Use

### Process your own images

```bash
curl -X POST "http://127.0.0.1:8000/process/" \
  -F "file=@/path/to/plate.jpg" \
  -F "model_type=rule"
```

Supported formats: JPEG, PNG, HEIC (converted automatically via `pillow-heif`).

### Model types

| `model_type` | Classifier | Labels |
|--------------|------------|--------|
| `binary` | `well_classifier_cnn.h5` | Effective, Ineffective |
| `multiclass` | `well_classifier_cnn_4_classes.h5` | Effective, Ineffective, Somewhat Effective, Unknown |
| `rule` | RGB peak distance | Effective, Somewhat Effective, Ineffective |

### Deploy to production

Set the `PORT` environment variable (default `8000`):

```bash
PORT=8080 uvicorn main:app --host 0.0.0.0 --port 8080
```

A deployed instance is available at `https://phagescan-api.onrender.com` (used by the mobile app in production builds).

### Connect the mobile app

In development, the app auto-detects your machine's IP via Expo and calls `http://<your-ip>:8000/process/`. Ensure:

- API is bound to `0.0.0.0` (not `127.0.0.1` only).
- Phone and computer are on the same Wi‑Fi network.

## API Reference

### `GET /`

Health check.

**Response:** `{"message": "Welcome to the Well Classification API!"}`

### `POST /process/`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | file | yes | — | Plate image (JPEG, PNG, or HEIC) |
| `model_type` | string | no | `binary` | `binary`, `multiclass`, or `rule` |

**Success (200):** `{"results": [...]}`

**Error (500):** `{"error": "<message>"}` — e.g. no circles detected, image unreadable.

## License

License to be specified. See the [root README](../README.md).
