# PhageScan deployed-app evaluation

Covers **only** the two classifiers
used by the current mobile app. Models are not retrained.

Workbook: `ml/results/app_evaluation/PhageScan_Model_Evaluation.xlsx`

## Methods used by the app

| Method | App control | API `model_type` | Classes |
|---|---|---|---|
| Binary CNN (`api/models/well_classifier_cnn.h5`) | Analyze Image (Binary) | `binary` (default) | Ineffective, Effective |
| Deterministic 3-class RGB rule | Analyze Image (Multi-Class) | `rule` | Effective, Somewhat Effective, Ineffective |

Excluded: 4-class CNN, historical 3-class CNN, Random Forest, and the binary RGB threshold-20 rule as a standalone app method.

## Binary CNN

- Production weights, `preprocess_image` (128×128, /255, BGR), `BINARY_LABELS` = ['Ineffective', 'Effective'].
- API verification (batched vs `_predict_label`): **pass**.
- Architecture: Conv16–Pool–Conv32–Pool–Flatten–Dense64–Dropout 0.3–Dense(2, softmax).
- Current ml/demo/segmented_wells files have zero MD5 overlap with the CNN_2 SegmentedWells training crops, so the full-demo score is not a training-set resubstitution of those original files.

### Training history (CNN_2.csv, 30 epochs — not a retrain)

Copied to `ml/results/binary_cnn/CNN_2.csv`. Final epoch train acc 1.0000, val acc 1.0000. See the Excel History sheet for all 30 epochs and the first epoch that reached best validation accuracy.

### Original held-out test (19 images) vs serving-aligned RGB rule

n = 19. Class counts: Ineffective=12, Effective=7.

- Accuracy: 1.0000
- Balanced accuracy: 1.0000
- Precision / recall / F1 (macro): 1.0000 / 1.0000 / 1.0000
- Precision / recall / F1 (weighted): 1.0000 / 1.0000 / 1.0000
- ROC AUC (Effective): 1.0000
- Average precision (Effective): 1.0000

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Ineffective | 12 | 1.0000 | 1.0000 | 1.0000 |
| Effective | 7 | 1.0000 | 1.0000 | 1.0000 |

Confusion matrix (rows = true):

| true \ pred | Ineffective | Effective |
|---|---:|---:|
| Ineffective | 12 | 0 |
| Effective | 0 | 7 |

**Validity:** These 19 wells were held out of the CNN_2 56/19/19 split. Labels are the binary RGB rule (distance < 20 → Effective), not wet-lab assays. 100% is RGB-rule agreement.

Original split: train 56, val 19, test 19. Train RGB-rule agreement 1.0000; validation 1.0000.

### Full current demo (94 images) vs `ground_truth_labels.csv`

n = 94. Class counts: Ineffective=47, Effective=47.

- Accuracy: 1.0000
- Balanced accuracy: 1.0000
- Precision / recall / F1 (macro): 1.0000 / 1.0000 / 1.0000
- Precision / recall / F1 (weighted): 1.0000 / 1.0000 / 1.0000
- ROC AUC (Effective): 1.0000
- Average precision (Effective): 1.0000

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Ineffective | 47 | 1.0000 | 1.0000 | 1.0000 |
| Effective | 47 | 1.0000 | 1.0000 | 1.0000 |

Confusion matrix (rows = true):

| true \ pred | Ineffective | Effective |
|---|---:|---:|
| Ineffective | 47 | 0 |
| Effective | 0 | 47 |

**Validity:** data/ground_truth_labels.csv matches the binary RGB rule (distance < 20 → Effective) on this demo plate and has not been independently verified as wet-lab ground truth. Report as label agreement on one demo plate, not independently validated biological accuracy.

## Deterministic 3-class RGB rule

- Source: `api.classification_utils._classify_well_rgb`
- Thresholds: distance <10 Effective; ≥10 and <25 Somewhat Effective; ≥25 Ineffective.
- Demo wells: 94
- Predicted counts: Effective 15 (16.0%), Somewhat Effective 32 (34.0%), Ineffective 47 (50.0%).

| Metric | Value |
|---|---|
| Accuracy, balanced accuracy | N/A |
| Precision, recall, F1 | N/A |
| ROC AUC, average precision | N/A |

**Why N/A:** No independent three-class reference labels exist in this repository. Existing 3-class Actual values from the historical notebook were produced by this same RGB rule, so scoring the rule against them would be circular rule agreement, not classification accuracy. Labels were not invented.

## In summary:

| Result | How to describe it | Do not describe it as |
|---|---|---|
| Binary CNN 100% on 19 held-out wells | Agreement with RGB-generated binary labels on the original CNN_2 test split | Independently verified biological accuracy |
| Binary CNN 100% on 94 demo wells | Agreement with `ground_truth_labels.csv` (those labels match the RGB rule) | A second independent wet-lab test |
| CNN_2 30-epoch curves | Training log for the binary CNN | A newly run experiment |
| 3-class RGB 15 / 32 / 47 | What the app Multi-Class button assigns on this demo plate | Accuracy of a 3-class model |

## Reproduction

```bash
cd ml
pip install -r requirements.txt
python evaluate_app_models.py
```

Optional original split:

```bash
export PHAGESCAN_ORIGINAL_WELLS=/path/to/PhageScan-lydia/SegmentedWells
python evaluate_app_models.py
```

Outputs: `ml/results/app_evaluation/`.
