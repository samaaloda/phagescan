# PhageScan ML

Standalone machine learning scripts for well plate segmentation, RGB-based classification, CNN evaluation, and Random Forest training.

## Contents

- [Overview](#overview)
- [Repo Contents](#repo-contents)
- [System Requirements](#system-requirements)
- [Installation Guide](#installation-guide)
- [Demo](#demo)
- [Instructions for Use](#instructions-for-use)
- [Reproducing Results](#reproducing-results)
- [License](#license)

## Overview

The `ml/` directory contains the research and prototyping code behind PhageScan's well analysis pipeline. It can be run independently of the API and mobile app for:

- Segmenting wells from plate photos
- Classifying wells by RGB color distance
- Evaluating the app's binary CNN and 3-class RGB rule (and characterizing the API-only 4-class CNN)
- Evaluating the RGB rule and a Random Forest on demo-well labels (historical / optional baseline)
- Training a Random Forest classifier on RGB histogram features

## Repo Contents

| Path | Description |
|------|-------------|
| `segmentation.py` | Detect and crop wells from a plate image |
| `rgb_classifier.py` | Classify segmented wells using RGB peak distance |
| `evaluate.py` | Compare predictions to ground truth, compute accuracy |
| `train_random_forest.py` | Train/evaluate a Random Forest on RGB histograms |
| `demo/plate.jpeg` | Demo plate photograph |
| `demo/segmented_wells/` | Pre-segmented demo wells (94 PNGs; `circle_1_11` and `circle_1_12` are missing) |
| `data/ground_truth_labels.csv` | Demo-well labels used for RGB and RF evaluation (not independently verified as biological ground truth) |
| `data/classification_results.csv` | RGB classifier output (generated) |
| `data/merged_results_with_accuracy.csv` | RGB vs label merge from `evaluate.py` (generated) |
| `data/rf_blind_test_results.csv` | Random Forest holdout predictions from `train_random_forest.py` (generated) |
| `data/archive/` | Legacy files, including an unused RF label CSV |
| `evaluate_app_models.py` | App/API classifier evaluation (binary CNN, 3-class RGB, 4-class CNN) |
| `report_metrics.py` | Historical RGB-rule and Random Forest metrics (writes to `data/archive/`) |
| `results/` | App-model metrics only: binary CNN, 3-class RGB, 4-class CNN |
| `requirements.txt` | Python dependencies |

## System Requirements

### Hardware

| | Minimum | Recommended |
|---|---------|-------------|
| RAM | 4 GB | 8+ GB |
| CPU | 2 cores | 4+ cores @ 3+ GHz |

No GPU required. OpenCV and scikit-learn run on CPU.

### Software

- **Python** 3.11
- **OS:** macOS 14+, Linux (Ubuntu 22.04+)

**Dependencies** (from `requirements.txt`):

```
opencv-python-headless, numpy, pandas, scikit-learn, matplotlib, tensorflow
```

TensorFlow is required for `evaluate_app_models.py` (binary and 4-class CNNs). The RGB/Random Forest scripts run without it.

## Installation Guide

```bash
cd ml
pip install -r requirements.txt
```

**Typical install time:** ~1–2 minutes.

## Demo

### 1. Segment the demo plate (~2 seconds)

```bash
python segmentation.py
```

**Input:** `demo/plate.jpeg`

**Output:** `segmented_output/circle_<row>_<col>.png` (one PNG per detected well)

**Expected console output:**

```
Saved <N> segmented wells to <path>/segmented_output
```

For the bundled demo plate, expect ~96 wells.

### 2. Classify segmented wells with RGB rules (~1 second)

```bash
python rgb_classifier.py
```

**Input:** `demo/segmented_wells/` (pre-segmented demo data)

**Output:** `data/classification_results.csv`

**Expected console output:**

```
Saved 96 classifications to data/classification_results.csv
```

**Expected CSV format:**

| Filename | Classification |
|----------|----------------|
| circle_1_1.png | Effective |
| circle_1_2.png | Ineffective |
| ... | ... |

### 3. Evaluate against ground truth (~1 second)

```bash
python evaluate.py
```

**Input:** `data/classification_results.csv`, `data/ground_truth_labels.csv`

**Output:** `data/merged_results_with_accuracy.csv`

**Expected console output:**

```
Matched wells: 96
Accuracy: XX.XX%
Saved merged results to data/merged_results_with_accuracy.csv
```

### 4. Train Random Forest (~5 seconds)

```bash
python train_random_forest.py
```

**Input:** `data/ground_truth_labels.csv`, `demo/segmented_wells/`

**Output:** `data/rf_blind_test_results.csv`, classification report printed to stdout.

**Expected runtime:** ~5–10 seconds.

## Instructions for Use

### Segment your own plate

Edit the `__main__` block in `segmentation.py` or call `segment_wells()` directly:

```python
from segmentation import segment_wells
from pathlib import Path

paths = segment_wells(
    image_path=Path("path/to/your_plate.jpg"),
    output_folder=Path("output/segmented_wells"),
)
print(f"Saved {len(paths)} wells")
```

### Classify your own segmented wells

```python
from rgb_classifier import classify_folder
from pathlib import Path

df = classify_folder(Path("output/segmented_wells"))
df.to_csv("my_results.csv", index=False)
```

### Evaluate with your own ground truth

Create a CSV with columns `Filename` and `Classification`, then:

```python
from evaluate import evaluate_predictions

evaluate_predictions(
    predictions_csv="my_results.csv",
    ground_truth_csv="my_labels.csv",
    output_csv="my_evaluation.csv",
)
```

## Reproducing Results

### Application classifiers (preferred)

This is the evaluation that matches what the mobile app actually calls:

```bash
cd ml
pip install -r requirements.txt
python evaluate_app_models.py
```

Optional — recover the original CNN_2 56/19/19 split if those training crops are on disk:

```bash
export PHAGESCAN_ORIGINAL_WELLS=/path/to/PhageScan-lydia/SegmentedWells
python evaluate_app_models.py
```

| Step | Script | Output |
|------|--------|--------|
| App/API models | `evaluate_app_models.py` | `results/` including `EVALUATION_REPORT.md` |

### Historical RGB rule and Random Forest

These methods are **not** used by the current app and are not stored in `results/`. The scripts remain; optional regenerated outputs go under `data/archive/`:

```bash
python rgb_classifier.py
python evaluate.py
python train_random_forest.py
python report_metrics.py
```

| Step | Script | Output |
|------|--------|--------|
| Classify | `rgb_classifier.py` | `data/classification_results.csv` |
| Evaluate | `evaluate.py` | `data/merged_results_with_accuracy.csv` |
| Train RF | `train_random_forest.py` | `data/rf_blind_test_results.csv` |
| Metrics | `report_metrics.py` | `data/archive/rf_rgb_evaluation/` |

Labels: `data/ground_truth_labels.csv` for both RGB and Random Forest.

## Evaluation setup

App/API evaluations (`python evaluate_app_models.py`):

1. **Binary CNN** — deployed `api/models/well_classifier_cnn.h5`, production preprocessing and `BINARY_LABELS`. Full 94-well demo vs `data/ground_truth_labels.csv`. If original `SegmentedWells` are available, also the recovered CNN_2 train/val/test split vs the serving-aligned RGB rule.
2. **3-class RGB rule** — production thresholds (&lt;10 Effective, &lt;25 Somewhat Effective, else Ineffective). Predictions only; no independent 3-class labels exist.
3. **4-class CNN** — API-only `well_classifier_cnn_4_classes.h5`. Architecture and prediction characterization only; no 4-class labels exist.

Historical evaluations (`python report_metrics.py`), kept separate:

1. **Binary RGB rule** — full set of 94 demo wells vs `data/ground_truth_labels.csv`.
2. **Random Forest holdout** — stratified 80/20 split (`random_state=42`); 100 trees, `class_weight="balanced"`.
3. **Random Forest 5-fold CV** — `StratifiedKFold` on the same 94 wells.

A legacy 136-row RF label file lives in `data/archive/` and is **not** used.

### Label caveat

`data/ground_truth_labels.csv` has **not** been independently verified as biological ground truth (no wet-lab assay recorded in this repo). On the demo plate these labels match the RGB distance rule (threshold 20). High CNN/RGB/RF scores therefore mean the models agree with this labeling on one plate; they are not evidence that the pipeline detects experimentally confirmed phage effectiveness.

## Metrics report

Application models:

```bash
cd ml
python evaluate_app_models.py
```

Outputs: `results/EVALUATION_REPORT.md`, `results/binary_cnn/`, `results/three_class_rgb/`, `results/four_class_cnn/`, and `results/figures/` (300 DPI PNGs).

Historical RGB/RF (optional, not app results):

```bash
cd ml
python report_metrics.py
```

Outputs: `data/archive/rf_rgb_evaluation/`. This does not write into `results/`.

## License

MIT. See the [root README](../README.md).
