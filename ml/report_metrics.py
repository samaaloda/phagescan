#!/usr/bin/env python3
"""Historical RGB-rule and Random Forest metrics (not used by the app).

App/API evaluation lives in evaluate_app_models.py and writes to ml/results/.
This script writes under data/archive/rf_rgb_evaluation/ so it does not mix
with the binary CNN, 3-class RGB, and 4-class CNN outputs.

Re-run from ml/:
    python report_metrics.py
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, train_test_split

from rgb_classifier import RGB_THRESHOLD, calculate_rgb_peaks, classify_well_rgb
from train_random_forest import extract_features

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
WELLS_DIR = BASE_DIR / "demo" / "segmented_wells"
RESULTS_DIR = BASE_DIR / "data" / "archive" / "rf_rgb_evaluation"
FIGURES_DIR = RESULTS_DIR / "figures"

CLASSES = ["ineffective", "effective"]
RANDOM_STATE = 42
TEST_SIZE = 0.2
N_FOLDS = 5
N_ESTIMATORS = 100


def _normalize_label(value) -> str:
    return str(value).strip().lower()


def load_labels(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["Filename"] = df["Filename"].astype(str)
    df["Classification"] = df["Classification"].map(_normalize_label)
    return df[["Filename", "Classification"]]


def existing_wells(df: pd.DataFrame) -> pd.DataFrame:
    present = {p.name for p in WELLS_DIR.glob("*.png")}
    matched = df[df["Filename"].isin(present)].copy()
    missing = len(df) - len(matched)
    if missing:
        print(f"  Skipping {missing} labeled files with no image in {WELLS_DIR}")
    return matched.reset_index(drop=True)


def labels_to_binary(series: pd.Series) -> np.ndarray:
    return (series.map(_normalize_label) == "effective").astype(int).to_numpy()


def rgb_distance(image_path: Path) -> float:
    peaks = calculate_rgb_peaks(image_path)
    return float(
        np.sqrt(
            (peaks["b"] - peaks["g"]) ** 2
            + (peaks["g"] - peaks["r"]) ** 2
            + (peaks["b"] - peaks["r"]) ** 2
        )
    )


def confusion_counts(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def per_class_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Recall per class, often reported as class-wise accuracy."""
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    with np.errstate(divide="ignore", invalid="ignore"):
        recalls = np.divide(np.diag(cm), cm.sum(axis=1), where=cm.sum(axis=1) != 0)
    return {
        "ineffective": float(recalls[0]) if cm.sum(axis=1)[0] else None,
        "effective": float(recalls[1]) if cm.sum(axis=1)[1] else None,
    }


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_score: np.ndarray | None = None) -> dict:
    counts = confusion_counts(y_true, y_pred)
    tn, fp, fn, tp = counts["tn"], counts["fp"], counts["fn"], counts["tp"]
    support = {
        "ineffective": int((y_true == 0).sum()),
        "effective": int((y_true == 1).sum()),
        "total": int(len(y_true)),
    }

    specificity_ineffective = tn / (tn + fp) if (tn + fp) else None
    specificity_effective = tp / (tp + fn) if (tp + fn) else None

    metrics = {
        "n": support["total"],
        "support": support,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "class_accuracy": per_class_accuracy(y_true, y_pred),
        "confusion_matrix": {
            "labels": CLASSES,
            "counts": [[tn, fp], [fn, tp]],
            "normalized_true": confusion_matrix(
                y_true, y_pred, labels=[0, 1], normalize="true"
            ).tolist(),
            "normalized_pred": confusion_matrix(
                y_true, y_pred, labels=[0, 1], normalize="pred"
            ).tolist(),
        },
        "precision": {
            "ineffective": float(precision_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "effective": float(precision_score(y_true, y_pred, pos_label=1, zero_division=0)),
            "macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
            "weighted": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
            "micro": float(precision_score(y_true, y_pred, average="micro", zero_division=0)),
        },
        "recall": {
            "ineffective": float(recall_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "effective": float(recall_score(y_true, y_pred, pos_label=1, zero_division=0)),
            "macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
            "weighted": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
            "micro": float(recall_score(y_true, y_pred, average="micro", zero_division=0)),
        },
        "f1": {
            "ineffective": float(f1_score(y_true, y_pred, pos_label=0, zero_division=0)),
            "effective": float(f1_score(y_true, y_pred, pos_label=1, zero_division=0)),
            "macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
            "weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
            "micro": float(f1_score(y_true, y_pred, average="micro", zero_division=0)),
        },
        "specificity": {
            "ineffective": float(specificity_ineffective) if specificity_ineffective is not None else None,
            "effective": float(specificity_effective) if specificity_effective is not None else None,
        },
        "matthews_corrcoef": float(matthews_corrcoef(y_true, y_pred)),
        "cohen_kappa": float(cohen_kappa_score(y_true, y_pred)),
        "sklearn_report": classification_report(
            y_true,
            y_pred,
            labels=[0, 1],
            target_names=CLASSES,
            zero_division=0,
            output_dict=True,
        ),
    }

    if y_score is not None and len(np.unique(y_true)) == 2:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_score))
        metrics["average_precision"] = float(average_precision_score(y_true, y_score))
    else:
        metrics["roc_auc"] = None
        metrics["average_precision"] = None

    return metrics


def flatten_metrics(model_name: str, split: str, metrics: dict) -> dict:
    row = {
        "model": model_name,
        "split": split,
        "n": metrics["n"],
        "accuracy": metrics["accuracy"],
        "balanced_accuracy": metrics["balanced_accuracy"],
        "precision_ineffective": metrics["precision"]["ineffective"],
        "precision_effective": metrics["precision"]["effective"],
        "precision_macro": metrics["precision"]["macro"],
        "precision_weighted": metrics["precision"]["weighted"],
        "precision_micro": metrics["precision"]["micro"],
        "recall_ineffective": metrics["recall"]["ineffective"],
        "recall_effective": metrics["recall"]["effective"],
        "recall_macro": metrics["recall"]["macro"],
        "recall_weighted": metrics["recall"]["weighted"],
        "recall_micro": metrics["recall"]["micro"],
        "f1_ineffective": metrics["f1"]["ineffective"],
        "f1_effective": metrics["f1"]["effective"],
        "f1_macro": metrics["f1"]["macro"],
        "f1_weighted": metrics["f1"]["weighted"],
        "f1_micro": metrics["f1"]["micro"],
        "specificity_ineffective": metrics["specificity"]["ineffective"],
        "specificity_effective": metrics["specificity"]["effective"],
        "matthews_corrcoef": metrics["matthews_corrcoef"],
        "cohen_kappa": metrics["cohen_kappa"],
        "roc_auc": metrics["roc_auc"],
        "average_precision": metrics["average_precision"],
        "tn": metrics["confusion_matrix"]["counts"][0][0],
        "fp": metrics["confusion_matrix"]["counts"][0][1],
        "fn": metrics["confusion_matrix"]["counts"][1][0],
        "tp": metrics["confusion_matrix"]["counts"][1][1],
        "support_ineffective": metrics["support"]["ineffective"],
        "support_effective": metrics["support"]["effective"],
    }
    return row


def save_confusion_csv(metrics: dict, path: Path) -> None:
    labels = metrics["confusion_matrix"]["labels"]
    counts = np.array(metrics["confusion_matrix"]["counts"])
    df = pd.DataFrame(counts, index=[f"true_{l}" for l in labels], columns=[f"pred_{l}" for l in labels])
    df.to_csv(path)


def plot_confusion(metrics: dict, title: str, path: Path, normalize: bool = False) -> None:
    labels = ["Ineffective", "Effective"]
    if normalize:
        matrix = np.array(metrics["confusion_matrix"]["normalized_true"])
        fmt = ".2f"
        vmax = 1.0
    else:
        matrix = np.array(metrics["confusion_matrix"]["counts"])
        fmt = "d"
        vmax = matrix.max() if matrix.max() else 1

    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    im = ax.imshow(matrix, cmap="Blues", vmin=0, vmax=vmax)
    ax.set_xticks([0, 1], labels)
    ax.set_yticks([0, 1], labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(2):
        for j in range(2):
            value = matrix[i, j]
            text = f"{value:{fmt}}"
            ax.text(j, i, text, ha="center", va="center", color="white" if value > vmax * 0.6 else "black")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def plot_per_class_bars(metrics_by_model: dict[str, dict], path: Path) -> None:
    names = list(metrics_by_model)
    x = np.arange(len(CLASSES))
    width = 0.35
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.8), sharey=True)
    for ax, metric_name in zip(axes, ["precision", "recall", "f1"]):
        for i, name in enumerate(names):
            values = [metrics_by_model[name][metric_name][cls] for cls in CLASSES]
            ax.bar(x + (i - (len(names) - 1) / 2) * width, values, width, label=name)
        ax.set_xticks(x, ["Ineffective", "Effective"])
        ax.set_ylim(0, 1.05)
        ax.set_title(metric_name.capitalize())
        ax.grid(axis="y", alpha=0.3)
    axes[0].legend(frameon=False)
    fig.suptitle("Per-class metrics")
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def plot_model_comparison(rows: list[dict], path: Path) -> None:
    df = pd.DataFrame(rows)
    metrics = ["accuracy", "balanced_accuracy", "f1_macro", "precision_macro", "recall_macro"]
    x = np.arange(len(metrics))
    width = 0.35
    fig, ax = plt.subplots(figsize=(8.5, 4.2))
    for i, (_, row) in enumerate(df.iterrows()):
        values = [row[m] for m in metrics]
        ax.bar(x + (i - (len(df) - 1) / 2) * width, values, width, label=row["model"])
    ax.set_xticks(x, ["Accuracy", "Balanced acc.", "F1 macro", "Prec. macro", "Recall macro"])
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score")
    ax.set_title("Holdout / full-set model comparison")
    ax.legend(frameon=False)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def plot_roc(y_true: np.ndarray, y_score: np.ndarray, title: str, path: Path) -> None:
    fpr, tpr, _ = roc_curve(y_true, y_score)
    auc = roc_auc_score(y_true, y_score)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(fpr, tpr, label=f"AUC = {auc:.3f}")
    ax.plot([0, 1], [0, 1], "--", color="gray")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title(title)
    ax.legend(frameon=False)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def plot_pr(y_true: np.ndarray, y_score: np.ndarray, title: str, path: Path) -> None:
    precision, recall, _ = precision_recall_curve(y_true, y_score)
    ap = average_precision_score(y_true, y_score)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(recall, precision, label=f"AP = {ap:.3f}")
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title(title)
    ax.legend(frameon=False)
    ax.grid(alpha=0.3)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.05)
    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def print_block(title: str, metrics: dict) -> None:
    print(f"\n=== {title} ===")
    print(f"n = {metrics['n']}  (ineffective={metrics['support']['ineffective']}, effective={metrics['support']['effective']})")
    print(f"Accuracy:           {metrics['accuracy']:.4f}")
    print(f"Balanced accuracy:  {metrics['balanced_accuracy']:.4f}")
    print(f"Precision  ineffect/effect/macro/weighted: {metrics['precision']['ineffective']:.4f} / {metrics['precision']['effective']:.4f} / {metrics['precision']['macro']:.4f} / {metrics['precision']['weighted']:.4f}")
    print(f"Recall     ineffect/effect/macro/weighted: {metrics['recall']['ineffective']:.4f} / {metrics['recall']['effective']:.4f} / {metrics['recall']['macro']:.4f} / {metrics['recall']['weighted']:.4f}")
    print(f"F1         ineffect/effect/macro/weighted: {metrics['f1']['ineffective']:.4f} / {metrics['f1']['effective']:.4f} / {metrics['f1']['macro']:.4f} / {metrics['f1']['weighted']:.4f}")
    print(f"MCC: {metrics['matthews_corrcoef']:.4f}   Kappa: {metrics['cohen_kappa']:.4f}")
    if metrics["roc_auc"] is not None:
        print(f"ROC AUC: {metrics['roc_auc']:.4f}   Avg precision: {metrics['average_precision']:.4f}")
    cm = metrics["confusion_matrix"]["counts"]
    print("Confusion matrix [true\\pred] ineffective, effective:")
    print(f"  {cm[0]}\n  {cm[1]}")


def evaluate_rgb(labels: pd.DataFrame) -> tuple[dict, np.ndarray, np.ndarray, np.ndarray]:
    y_true, y_pred, y_score = [], [], []
    rows = []
    for _, row in labels.iterrows():
        path = WELLS_DIR / row["Filename"]
        peaks = calculate_rgb_peaks(path)
        distance = rgb_distance(path)
        pred = _normalize_label(classify_well_rgb(peaks))
        y_true.append(1 if row["Classification"] == "effective" else 0)
        y_pred.append(1 if pred == "effective" else 0)
        y_score.append(-distance)
        rows.append(
            {
                "Filename": row["Filename"],
                "Actual": row["Classification"],
                "Predicted": pred,
                "rgb_distance": distance,
                "threshold": RGB_THRESHOLD,
            }
        )
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    y_score = np.array(y_score)
    pd.DataFrame(rows).to_csv(RESULTS_DIR / "rgb_predictions.csv", index=False)
    return compute_metrics(y_true, y_pred, y_score), y_true, y_pred, y_score


def fit_rf(X_train, y_train) -> RandomForestClassifier:
    model = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        random_state=RANDOM_STATE,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)
    return model


def evaluate_rf_holdout(labels: pd.DataFrame, name: str) -> tuple[dict, np.ndarray, np.ndarray, np.ndarray]:
    X, y, filenames = extract_features(labels, WELLS_DIR)
    X_train, X_test, y_train, y_test, files_train, files_test = train_test_split(
        X,
        y,
        filenames,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )
    model = fit_rf(X_train, y_train)
    y_pred = model.predict(X_test)
    y_score = model.predict_proba(X_test)[:, 1]
    pd.DataFrame(
        {
            "Filename": files_test,
            "Actual": ["effective" if v else "ineffective" for v in y_test],
            "Predicted": ["effective" if v else "ineffective" for v in y_pred],
            "score_effective": y_score,
        }
    ).to_csv(RESULTS_DIR / f"{name}_holdout_predictions.csv", index=False)
    return compute_metrics(y_test, y_pred, y_score), y_test, y_pred, y_score


def evaluate_rf_cv(labels: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    X, y, _ = extract_features(labels, WELLS_DIR)
    kfold = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    fold_rows = []
    for fold, (train_idx, test_idx) in enumerate(kfold.split(X, y), start=1):
        model = fit_rf(X[train_idx], y[train_idx])
        y_pred = model.predict(X[test_idx])
        y_score = model.predict_proba(X[test_idx])[:, 1]
        metrics = compute_metrics(y[test_idx], y_pred, y_score)
        fold_rows.append(flatten_metrics("random_forest", f"fold_{fold}", metrics))

    fold_df = pd.DataFrame(fold_rows)
    summary = {
        col: {
            "mean": float(fold_df[col].mean()),
            "std": float(fold_df[col].std(ddof=1)),
        }
        for col in [
            "accuracy",
            "balanced_accuracy",
            "precision_macro",
            "precision_weighted",
            "recall_macro",
            "recall_weighted",
            "f1_macro",
            "f1_weighted",
            "matthews_corrcoef",
            "cohen_kappa",
            "roc_auc",
            "average_precision",
        ]
    }
    return summary, fold_df


def _fmt(value) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "—"
    return f"{value:.4f}"


def write_markdown_report(
    summary_df: pd.DataFrame,
    cv_summary: dict,
    rgb_metrics: dict,
    rf_gt_metrics: dict,
) -> None:
    lines = [
        "# PhageScan ML metrics",
        "",
        "Generated by `python report_metrics.py`. Classes: **ineffective** / **effective** (positive = effective).",
        "",
        "## Models",
        "",
        f"- **RGB rule:** well is Effective if RGB-peak distance < {RGB_THRESHOLD}, else Ineffective. Evaluated on all demo wells vs `data/ground_truth_labels.csv`.",
        "- **Random Forest:** 100 trees, `class_weight='balanced'`, RGB histogram features (768-d). Holdout is stratified 80/20 (`random_state=42`).",
        "",
        "## Headline numbers",
        "",
        "| Model | Split | n | Accuracy | Balanced acc. | F1 macro | Prec. macro | Recall macro | ROC AUC |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for _, row in summary_df.iterrows():
        lines.append(
            f"| {row['model']} | {row['split']} | {int(row['n'])} | {_fmt(row['accuracy'])} | {_fmt(row['balanced_accuracy'])} | {_fmt(row['f1_macro'])} | {_fmt(row['precision_macro'])} | {_fmt(row['recall_macro'])} | {_fmt(row['roc_auc'])} |"
        )
    lines += [
        "",
        "### Random Forest 5-fold CV vs `ground_truth_labels.csv`",
        "",
        "| Metric | Mean | Std |",
        "|---|---:|---:|",
    ]
    for key, value in cv_summary.items():
        lines.append(f"| {key} | {_fmt(value['mean'])} | {_fmt(value['std'])} |")

    def class_table(title: str, metrics: dict) -> list[str]:
        return [
            "",
            f"## {title}",
            "",
            f"n={metrics['n']} (ineffective={metrics['support']['ineffective']}, effective={metrics['support']['effective']})",
            "",
            "| | Ineffective | Effective | Macro | Weighted | Micro |",
            "|---|---:|---:|---:|---:|---:|",
            f"| Precision | {_fmt(metrics['precision']['ineffective'])} | {_fmt(metrics['precision']['effective'])} | {_fmt(metrics['precision']['macro'])} | {_fmt(metrics['precision']['weighted'])} | {_fmt(metrics['precision']['micro'])} |",
            f"| Recall | {_fmt(metrics['recall']['ineffective'])} | {_fmt(metrics['recall']['effective'])} | {_fmt(metrics['recall']['macro'])} | {_fmt(metrics['recall']['weighted'])} | {_fmt(metrics['recall']['micro'])} |",
            f"| F1 | {_fmt(metrics['f1']['ineffective'])} | {_fmt(metrics['f1']['effective'])} | {_fmt(metrics['f1']['macro'])} | {_fmt(metrics['f1']['weighted'])} | {_fmt(metrics['f1']['micro'])} |",
            "",
            f"Accuracy {_fmt(metrics['accuracy'])} · balanced accuracy {_fmt(metrics['balanced_accuracy'])} · MCC {_fmt(metrics['matthews_corrcoef'])} · kappa {_fmt(metrics['cohen_kappa'])}",
            "",
            "Confusion matrix (rows = true, columns = predicted):",
            "",
            "|  | pred ineffective | pred effective |",
            "|---|---:|---:|",
            f"| true ineffective | {metrics['confusion_matrix']['counts'][0][0]} | {metrics['confusion_matrix']['counts'][0][1]} |",
            f"| true effective | {metrics['confusion_matrix']['counts'][1][0]} | {metrics['confusion_matrix']['counts'][1][1]} |",
            "",
        ]

    lines += class_table("RGB rule — full demo set", rgb_metrics)
    lines += class_table("Random Forest — holdout vs ground_truth_labels.csv", rf_gt_metrics)
    lines += [
        "## Notes",
        "",
        "- All scores use `data/ground_truth_labels.csv` on the 94 demo wells in `demo/segmented_wells/`.",
        "- These labels have **not** been independently verified as biological ground truth. On this demo plate they match the RGB distance rule (threshold 20), so 100% RGB accuracy means the labels agree with the rule, not that the rule was tested against a wet-lab assay.",
        "- The Random Forest is trained on RGB histogram features against the same labels, so holdout/CV scores measure how well color histograms reproduce that labeling on wells from a single plate.",
        "- Figures: `data/archive/rf_rgb_evaluation/figures/`.",
        "",
    ]
    (RESULTS_DIR / "METRICS.md").write_text("\n".join(lines))


def main() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    gt = existing_wells(load_labels(DATA_DIR / "ground_truth_labels.csv"))

    print("Evaluating RGB rule classifier on ground_truth_labels.csv")
    rgb_metrics, rgb_y, rgb_pred, rgb_score = evaluate_rgb(gt)
    print_block(f"RGB rule (threshold={RGB_THRESHOLD}) — full demo wells", rgb_metrics)

    print("\nEvaluating Random Forest on ground_truth_labels.csv (stratified 80/20 holdout)")
    rf_gt_metrics, rf_gt_y, rf_gt_pred, rf_gt_score = evaluate_rf_holdout(gt, "rf_ground_truth")
    print_block("Random Forest — holdout vs ground_truth_labels", rf_gt_metrics)

    print(f"\nEvaluating Random Forest  {N_FOLDS}-fold CV on ground_truth_labels.csv")
    cv_summary, cv_df = evaluate_rf_cv(gt)
    cv_df.to_csv(RESULTS_DIR / "rf_ground_truth_cv_folds.csv", index=False)
    print("CV mean ± std:")
    for key, value in cv_summary.items():
        print(f"  {key:22s} {value['mean']:.4f} ± {value['std']:.4f}")

    summary_rows = [
        flatten_metrics("rgb_rule", "full", rgb_metrics),
        flatten_metrics("random_forest_gt_labels", "holdout", rf_gt_metrics),
    ]
    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(RESULTS_DIR / "metrics_summary.csv", index=False)

    save_confusion_csv(rgb_metrics, RESULTS_DIR / "confusion_matrix_rgb.csv")
    save_confusion_csv(rf_gt_metrics, RESULTS_DIR / "confusion_matrix_rf_gt.csv")

    payload = {
        "rgb_rule_full": rgb_metrics,
        "random_forest_ground_truth_holdout": rf_gt_metrics,
        "random_forest_ground_truth_cv": cv_summary,
        "notes": {
            "classes": CLASSES,
            "positive_class": "effective",
            "rgb_threshold": RGB_THRESHOLD,
            "labels_independently_verified": False,
            "rf": {
                "n_estimators": N_ESTIMATORS,
                "class_weight": "balanced",
                "test_size": TEST_SIZE,
                "n_folds": N_FOLDS,
                "random_state": RANDOM_STATE,
            },
            "label_sets": {
                "ground_truth_labels.csv_n": int(len(gt)),
            },
        },
    }
    with (RESULTS_DIR / "metrics.json").open("w") as handle:
        json.dump(payload, handle, indent=2)

    plot_confusion(rgb_metrics, "RGB rule — confusion matrix", FIGURES_DIR / "cm_rgb.png")
    plot_confusion(
        rgb_metrics,
        "RGB rule — row-normalized confusion matrix",
        FIGURES_DIR / "cm_rgb_normalized.png",
        normalize=True,
    )
    plot_confusion(
        rf_gt_metrics,
        "Random Forest (GT labels) — confusion matrix",
        FIGURES_DIR / "cm_rf_gt.png",
    )
    plot_confusion(
        rf_gt_metrics,
        "Random Forest (GT labels) — row-normalized confusion matrix",
        FIGURES_DIR / "cm_rf_gt_normalized.png",
        normalize=True,
    )
    plot_roc(rgb_y, rgb_score, "RGB rule ROC (score = −distance)", FIGURES_DIR / "roc_rgb.png")
    plot_pr(rgb_y, rgb_score, "RGB rule precision–recall", FIGURES_DIR / "pr_rgb.png")
    plot_roc(rf_gt_y, rf_gt_score, "Random Forest ROC (GT labels holdout)", FIGURES_DIR / "roc_rf_gt.png")
    plot_pr(rf_gt_y, rf_gt_score, "Random Forest precision–recall (GT labels)", FIGURES_DIR / "pr_rf_gt.png")
    plot_per_class_bars(
        {
            "RGB rule": rgb_metrics,
            "RF (GT holdout)": rf_gt_metrics,
        },
        FIGURES_DIR / "per_class_metrics.png",
    )
    plot_model_comparison(summary_rows, FIGURES_DIR / "model_comparison.png")

    write_markdown_report(summary_df, cv_summary, rgb_metrics, rf_gt_metrics)

    print(f"\nWrote tables to {RESULTS_DIR}")
    print(f"Wrote figures to {FIGURES_DIR}")
    print(f"Wrote {RESULTS_DIR / 'METRICS.md'}")


if __name__ == "__main__":
    main()
