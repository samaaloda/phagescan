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
- Evaluating predictions against ground-truth labels
- Training a Random Forest classifier on RGB histogram features

## Repo Contents

| Path | Description |
|------|-------------|
| `segmentation.py` | Detect and crop wells from a plate image |
| `rgb_classifier.py` | Classify segmented wells using RGB peak distance |
| `evaluate.py` | Compare predictions to ground truth, compute accuracy |
| `train_random_forest.py` | Train/evaluate a Random Forest on RGB histograms |
| `demo/plate.jpeg` | Demo plate photograph |
| `demo/segmented_wells/` | Pre-segmented demo wells (96 PNGs, `circle_<row>_<col>.png`) |
| `data/ground_truth_labels.csv` | Manual labels for demo wells |
| `data/classification_results.csv` | RGB classifier output (generated) |
| `data/merged_results_with_accuracy.csv` | Evaluation output (generated) |
| `data/rf_ground_truth_labels.csv` | Labels for Random Forest training |
| `data/rf_blind_test_results.csv` | Random Forest blind-test output (generated) |
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
opencv-python-headless, numpy, pandas, scikit-learn, matplotlib
```

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

**Input:** `data/rf_ground_truth_labels.csv`, `demo/segmented_wells/`

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

To reproduce the evaluation pipeline end-to-end:

```bash
cd ml
pip install -r requirements.txt

python rgb_classifier.py
python evaluate.py
python train_random_forest.py
```

| Step | Script | Output |
|------|--------|--------|
| Classify | `rgb_classifier.py` | `data/classification_results.csv` |
| Evaluate | `evaluate.py` | `data/merged_results_with_accuracy.csv` |
| Train RF | `train_random_forest.py` | `data/rf_blind_test_results.csv` |

Ground-truth labels: `data/ground_truth_labels.csv` (RGB evaluation), `data/rf_ground_truth_labels.csv` (Random Forest).

## License

License to be specified. See the [root README](../README.md).
