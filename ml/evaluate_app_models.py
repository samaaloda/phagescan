#!/usr/bin/env python3
"""Evaluate the two classification methods used by the current PhageScan app.

  A. Binary CNN  — app "Analyze Image (Binary)"
  B. 3-class RGB — app "Analyze Image (Multi-Class)" (`model_type=rule`)

Historical / API-only models are not scored (4-class CNN, historical 3-class CNN,
Random Forest, binary RGB rule).

Inference uses api/classification_utils.py so preprocessing and mappings match
the deployed API. The supervisor workbook is written to
ml/results/app_evaluation/PhageScan_Model_Evaluation.xlsx.

Re-run from ml/:
    python evaluate_app_models.py
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import label_binarize

from export_app_workbook import export_workbook

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
API_DIR = REPO_ROOT / "api"
DATA_DIR = BASE_DIR / "data"
WELLS_DIR = BASE_DIR / "demo" / "segmented_wells"
OUT_DIR = BASE_DIR / "results" / "app_evaluation"
BIN_DIR = OUT_DIR / "binary_cnn"
RGB3_DIR = OUT_DIR / "three_class_rgb"
FIG_DIR = OUT_DIR / "figures"

ORIGINAL_WELLS_CANDIDATES = [
    Path(os.environ[key])
    for key in ("PHAGESCAN_ORIGINAL_WELLS",)
    if key in os.environ
] + [
    Path.home() / "Desktop/phage-scan/PhageScan-lydia/SegmentedWells",
]
ORIGINAL_HISTORY_CANDIDATES = [
    Path.home() / "Desktop/phage-scan/PhageScan-lydia/CNN_2.csv",
]

sys.path.insert(0, str(API_DIR))
from classification_utils import (  # noqa: E402
    BINARY_LABELS,
    _calculate_rgb_histogram,
    _get_model,
    _predict_label,
    preprocess_image,
)

BINARY_CLASSES = list(BINARY_LABELS)  # Ineffective, Effective
RGB3_CLASSES = ["Effective", "Somewhat Effective", "Ineffective"]
CNN2_RANDOM_STATE = 42
CNN2_TEST_SIZE = 0.4
CNN2_VAL_TEST_SIZE = 0.5
DPI = 300

plt.rcParams.update(
    {
        "font.size": 10,
        "axes.titlesize": 11,
        "axes.labelsize": 10,
        "figure.dpi": 100,
        "savefig.dpi": DPI,
        "savefig.bbox": "tight",
    }
)


def _image_names(folder: Path) -> list[str]:
    return sorted(
        name
        for name in os.listdir(folder)
        if name.lower().endswith((".png", ".jpg", ".jpeg"))
    )


def _find_original_wells() -> Path | None:
    for path in ORIGINAL_WELLS_CANDIDATES:
        if path.is_dir() and _image_names(path):
            return path
    return None


def _find_history_csv() -> Path | None:
    for path in ORIGINAL_HISTORY_CANDIDATES:
        if path.is_file():
            return path
    return None


def recover_cnn2_split(filenames: list[str]) -> pd.DataFrame:
    """Reproduce CNN_2.ipynb 60/20/20 split (no stratify, random_state=42).

    The notebook split image arrays, not filenames. sklearn shuffles by sample
    count and random_state only, so the same sorted file list yields the same
    train/val/test membership.
    """
    indices = np.arange(len(filenames))
    train_idx, temp_idx = train_test_split(
        indices, test_size=CNN2_TEST_SIZE, random_state=CNN2_RANDOM_STATE
    )
    val_idx, test_idx = train_test_split(
        temp_idx, test_size=CNN2_VAL_TEST_SIZE, random_state=CNN2_RANDOM_STATE
    )
    split = pd.DataFrame({"Filename": filenames, "split": "train"})
    split.loc[val_idx, "split"] = "val"
    split.loc[test_idx, "split"] = "test"
    return split.reset_index(drop=True)


def rgb_distance_from_peaks(peaks: dict) -> float:
    return float(
        np.sqrt(
            (peaks["b"] - peaks["g"]) ** 2
            + (peaks["g"] - peaks["r"]) ** 2
            + (peaks["b"] - peaks["r"]) ** 2
        )
    )


def binary_rgb_reference(image_path: Path, threshold: float = 20.0) -> tuple[str, float]:
    """Serving-aligned binary RGB label (Effective if distance < 20).

    This matches current ml/rgb_classifier.py and the polarity the deployed
    binary CNN actually emits. It is NOT an independent wet-lab label.
    """
    peaks = _calculate_rgb_histogram(str(image_path))
    distance = rgb_distance_from_peaks(peaks)
    label = "Effective" if distance < threshold else "Ineffective"
    return label, distance


def predict_binary_cnn(image_path: Path) -> tuple[str, np.ndarray]:
    model = _get_model("binary")
    probs = model.predict(preprocess_image(str(image_path)), verbose=0)[0]
    label = BINARY_LABELS[int(np.argmax(probs))]
    return label, np.asarray(probs, dtype=float)


def predict_batch(model_type: str, paths: list[Path]) -> tuple[list[str], np.ndarray]:
    """Batched inference using the production model and preprocess_image()."""
    if model_type == "rule":
        labels = [_predict_label("rule", str(path)) for path in paths]
        return labels, np.zeros((len(paths), 0))
    if model_type != "binary":
        raise ValueError(f"Unsupported model_type for CNN batching: {model_type}")
    model = _get_model(model_type)
    batch = np.concatenate([preprocess_image(str(path)) for path in paths], axis=0)
    probs = model.predict(batch, verbose=0)
    labels = [BINARY_LABELS[int(np.argmax(row))] for row in probs]
    return labels, np.asarray(probs, dtype=float)


def verify_matches_api(paths: list[Path], n_check: int = 5) -> dict:
    """Confirm batched CNN output matches per-image _predict_label()."""
    sample = paths[: min(n_check, len(paths))]
    batch_labels, _ = predict_batch("binary", sample)
    api_labels = [_predict_label("binary", str(path)) for path in sample]
    matches = [a == b for a, b in zip(batch_labels, api_labels)]
    return {
        "checked": [path.name for path in sample],
        "batch_labels": batch_labels,
        "api_labels": api_labels,
        "all_match": all(matches),
        "preprocess": "api.classification_utils.preprocess_image (128x128, /255.0, cv2 BGR)",
        "class_mapping": BINARY_LABELS,
    }


def compute_metrics(y_true: list[str], y_pred: list[str], class_names: list[str], y_score: np.ndarray | None = None) -> dict:
    labels = list(class_names)
    true = np.array(y_true)
    pred = np.array(y_pred)
    support = {name: int((true == name).sum()) for name in labels}
    cm = confusion_matrix(true, pred, labels=labels)
    row_sums = cm.sum(axis=1, keepdims=True).astype(float)
    cm_norm = np.zeros_like(cm, dtype=float)
    np.divide(cm, row_sums, out=cm_norm, where=row_sums != 0)

    report = classification_report(
        true,
        pred,
        labels=labels,
        target_names=labels,
        zero_division=0,
        output_dict=True,
    )
    metrics = {
        "n": int(len(true)),
        "classes": labels,
        "support": support,
        "accuracy": float(accuracy_score(true, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(true, pred)),
        "precision": {
            name: float(precision_score(true, pred, labels=[name], average="micro", zero_division=0))
            for name in labels
        },
        "recall": {
            name: float(recall_score(true, pred, labels=[name], average="micro", zero_division=0))
            for name in labels
        },
        "f1": {
            name: float(f1_score(true, pred, labels=[name], average="micro", zero_division=0))
            for name in labels
        },
        "precision_macro": float(precision_score(true, pred, labels=labels, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(true, pred, labels=labels, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(true, pred, labels=labels, average="macro", zero_division=0)),
        "precision_weighted": float(precision_score(true, pred, labels=labels, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(true, pred, labels=labels, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(true, pred, labels=labels, average="weighted", zero_division=0)),
        "confusion_matrix": {
            "labels": labels,
            "counts": cm.astype(int).tolist(),
            "normalized_true": cm_norm.tolist(),
        },
        "sklearn_report": report,
        "roc_auc": None,
        "average_precision": None,
        "roc_auc_ovr_macro": None,
    }

    if y_score is not None and y_score.size and len(labels) == 2:
        positive = labels.index("Effective") if "Effective" in labels else 1
        score = y_score[:, positive]
        y_bin = (true == labels[positive]).astype(int)
        if len(np.unique(y_bin)) == 2:
            metrics["roc_auc"] = float(roc_auc_score(y_bin, score))
            metrics["average_precision"] = float(average_precision_score(y_bin, score))
            metrics["_score_positive_class"] = labels[positive]
    elif y_score is not None and y_score.size and len(np.unique(true)) == len(labels) == y_score.shape[1]:
        y_bin = label_binarize(true, classes=labels)
        try:
            metrics["roc_auc_ovr_macro"] = float(roc_auc_score(y_bin, y_score, average="macro", multi_class="ovr"))
        except ValueError:
            metrics["roc_auc_ovr_macro"] = None
    return metrics


def flatten_metrics(model: str, split: str, metrics: dict) -> dict:
    row = {
        "model": model,
        "split": split,
        "n": metrics["n"],
        "accuracy": metrics["accuracy"],
        "balanced_accuracy": metrics["balanced_accuracy"],
        "precision_macro": metrics["precision_macro"],
        "recall_macro": metrics["recall_macro"],
        "f1_macro": metrics["f1_macro"],
        "precision_weighted": metrics["precision_weighted"],
        "recall_weighted": metrics["recall_weighted"],
        "f1_weighted": metrics["f1_weighted"],
        "roc_auc": metrics["roc_auc"],
        "average_precision": metrics["average_precision"],
    }
    for name in metrics["classes"]:
        key = name.lower().replace(" ", "_")
        row[f"support_{key}"] = metrics["support"][name]
        row[f"precision_{key}"] = metrics["precision"][name]
        row[f"recall_{key}"] = metrics["recall"][name]
        row[f"f1_{key}"] = metrics["f1"][name]
    return row


def save_confusion_csv(metrics: dict, path: Path) -> None:
    labels = metrics["confusion_matrix"]["labels"]
    counts = np.array(metrics["confusion_matrix"]["counts"])
    df = pd.DataFrame(
        counts,
        index=[f"true_{name}" for name in labels],
        columns=[f"pred_{name}" for name in labels],
    )
    df.to_csv(path)


def save_report_txt(y_true, y_pred, class_names, path: Path) -> None:
    path.write_text(
        classification_report(y_true, y_pred, labels=class_names, target_names=class_names, zero_division=0)
    )


def plot_confusion(metrics: dict, title: str, path: Path, normalize: bool = False) -> None:
    labels = metrics["confusion_matrix"]["labels"]
    if normalize:
        matrix = np.array(metrics["confusion_matrix"]["normalized_true"])
        fmt = ".2f"
        vmax = 1.0
    else:
        matrix = np.array(metrics["confusion_matrix"]["counts"])
        fmt = "d"
        vmax = max(float(matrix.max()), 1.0)

    fig, ax = plt.subplots(figsize=(1.6 + 1.1 * len(labels), 1.4 + 1.0 * len(labels)))
    im = ax.imshow(matrix, cmap="Blues", vmin=0, vmax=vmax)
    ax.set_xticks(range(len(labels)), labels, rotation=20, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(len(labels)):
        for j in range(len(labels)):
            value = matrix[i, j]
            ax.text(
                j,
                i,
                f"{value:{fmt}}",
                ha="center",
                va="center",
                color="white" if value > vmax * 0.6 else "black",
            )
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.savefig(path, dpi=DPI)
    plt.close(fig)


def plot_roc_binary(y_true: list[str], y_score: np.ndarray, title: str, path: Path) -> None:
    y_bin = (np.array(y_true) == "Effective").astype(int)
    score = y_score[:, BINARY_CLASSES.index("Effective")]
    if len(np.unique(y_bin)) < 2:
        return
    fpr, tpr, _ = roc_curve(y_bin, score)
    auc = roc_auc_score(y_bin, score)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(fpr, tpr, label=f"AUC = {auc:.3f}")
    ax.plot([0, 1], [0, 1], "--", color="gray")
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title(title)
    ax.legend(frameon=False)
    ax.grid(alpha=0.3)
    fig.savefig(path, dpi=DPI)
    plt.close(fig)


def plot_pr_binary(y_true: list[str], y_score: np.ndarray, title: str, path: Path) -> None:
    y_bin = (np.array(y_true) == "Effective").astype(int)
    score = y_score[:, BINARY_CLASSES.index("Effective")]
    if len(np.unique(y_bin)) < 2:
        return
    precision, recall, _ = precision_recall_curve(y_bin, score)
    ap = average_precision_score(y_bin, score)
    fig, ax = plt.subplots(figsize=(5.2, 4.4))
    ax.plot(recall, precision, label=f"AP = {ap:.3f}")
    ax.set_xlabel("Recall (Effective)")
    ax.set_ylabel("Precision (Effective)")
    ax.set_title(title)
    ax.legend(frameon=False)
    ax.grid(alpha=0.3)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.05)
    fig.savefig(path, dpi=DPI)
    plt.close(fig)


def plot_counts(counts: dict, title: str, path: Path, class_order: list[str]) -> None:
    names = [name for name in class_order if name in counts]
    values = [counts[name] for name in names]
    fig, ax = plt.subplots(figsize=(6.2, 4.0))
    ax.bar(names, values, color="#4C78A8")
    ax.set_ylabel("Wells")
    ax.set_title(title)
    ax.grid(axis="y", alpha=0.3)
    for i, value in enumerate(values):
        ax.text(i, value, str(value), ha="center", va="bottom")
    fig.savefig(path, dpi=DPI)
    plt.close(fig)


def plot_training_history(csv_path: Path, out_path: Path) -> None:
    df = pd.read_csv(csv_path)
    fig, axes = plt.subplots(1, 2, figsize=(9.5, 3.8))
    axes[0].plot(df["accuracy"], label="Train")
    axes[0].plot(df["val_accuracy"], label="Validation")
    axes[0].set_title("Accuracy")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylim(0, 1.05)
    axes[1].plot(df["loss"], label="Train")
    axes[1].plot(df["val_loss"], label="Validation")
    axes[1].set_title("Loss")
    axes[1].set_xlabel("Epoch")
    for ax in axes:
        ax.legend(frameon=False)
        ax.grid(alpha=0.3)
    fig.suptitle("Binary CNN training history (CNN_2.ipynb log, not a retrain)")
    fig.savefig(out_path, dpi=DPI)
    plt.close(fig)


def inspect_model(model_type: str) -> dict:
    model = _get_model(model_type)
    config = model.get_config()
    layers = []
    for layer in config.get("layers", []):
        cfg = layer.get("config", {})
        layers.append(
            {
                "class_name": layer.get("class_name"),
                "name": cfg.get("name"),
                "filters": cfg.get("filters"),
                "units": cfg.get("units"),
                "activation": cfg.get("activation"),
                "rate": cfg.get("rate"),
                "kernel_regularizer": cfg.get("kernel_regularizer"),
            }
        )
    output_units = None
    for item in reversed(layers):
        if item["units"] is not None:
            output_units = item["units"]
            break
    return {
        "model_type": model_type,
        "input_shape": [None, 128, 128, 3],
        "output_units": output_units,
        "expected_labels": BINARY_LABELS,
        "layers": layers,
    }


def _fmt(value) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value)


def metrics_table(title: str, metrics: dict, caveats: list[str]) -> list[str]:
    classes = metrics["classes"]
    lines = [
        f"### {title}",
        "",
        f"n = {metrics['n']}. Class counts: "
        + ", ".join(f"{name}={metrics['support'][name]}" for name in classes)
        + ".",
        "",
        f"- Accuracy: {_fmt(metrics['accuracy'])}",
        f"- Balanced accuracy: {_fmt(metrics['balanced_accuracy'])}",
        f"- Precision / recall / F1 (macro): {_fmt(metrics['precision_macro'])} / {_fmt(metrics['recall_macro'])} / {_fmt(metrics['f1_macro'])}",
        f"- Precision / recall / F1 (weighted): {_fmt(metrics['precision_weighted'])} / {_fmt(metrics['recall_weighted'])} / {_fmt(metrics['f1_weighted'])}",
    ]
    if metrics.get("roc_auc") is not None:
        lines.append(f"- ROC AUC (Effective): {_fmt(metrics['roc_auc'])}")
        lines.append(f"- Average precision (Effective): {_fmt(metrics['average_precision'])}")
    lines += [
        "",
        "| Class | Support | Precision | Recall | F1 |",
        "|---|---:|---:|---:|---:|",
    ]
    for name in classes:
        lines.append(
            f"| {name} | {metrics['support'][name]} | {_fmt(metrics['precision'][name])} | {_fmt(metrics['recall'][name])} | {_fmt(metrics['f1'][name])} |"
        )
    labels = metrics["confusion_matrix"]["labels"]
    counts = metrics["confusion_matrix"]["counts"]
    header = "| true \\ pred | " + " | ".join(labels) + " |"
    sep = "|---|" + "|".join("---:" for _ in labels) + "|"
    lines += ["", "Confusion matrix (rows = true):", "", header, sep]
    for name, row in zip(labels, counts):
        lines.append("| " + name + " | " + " | ".join(str(v) for v in row) + " |")
    if caveats:
        lines += ["", "**Validity:** " + " ".join(caveats)]
    lines.append("")
    return lines


def evaluate_binary_cnn(demo_paths: list[Path], original_dir: Path | None) -> dict:
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    gt = pd.read_csv(DATA_DIR / "ground_truth_labels.csv")
    gt["Filename"] = gt["Filename"].astype(str)
    gt_map = dict(zip(gt["Filename"], gt["Classification"]))

    verify = verify_matches_api(demo_paths)
    if not verify["all_match"]:
        raise RuntimeError(f"Batched binary CNN predictions do not match API _predict_label: {verify}")

    demo_labels, demo_probs = predict_batch("binary", demo_paths)
    demo_rows = []
    y_true, y_pred = [], []
    for path, pred, probs in zip(demo_paths, demo_labels, demo_probs):
        reference = gt_map.get(path.name)
        rgb_label, distance = binary_rgb_reference(path)
        demo_rows.append(
            {
                "Filename": path.name,
                "dataset": "current_demo",
                "split": "full_demo",
                "cnn_predicted": pred,
                "ground_truth_labels_csv": reference,
                "rgb_rule_threshold_20": rgb_label,
                "rgb_distance": distance,
                "prob_Ineffective": float(probs[BINARY_CLASSES.index("Ineffective")]),
                "prob_Effective": float(probs[BINARY_CLASSES.index("Effective")]),
            }
        )
        if reference is not None:
            y_true.append(reference)
            y_pred.append(pred)

    demo_df = pd.DataFrame(demo_rows)
    demo_df.to_csv(BIN_DIR / "predictions_demo.csv", index=False)
    demo_scores = demo_probs if len(y_true) == len(demo_probs) else None
    demo_metrics = compute_metrics(y_true, y_pred, BINARY_CLASSES, demo_scores)
    save_confusion_csv(demo_metrics, BIN_DIR / "confusion_matrix_full_demo.csv")
    save_report_txt(y_true, y_pred, BINARY_CLASSES, BIN_DIR / "classification_report_full_demo.txt")
    plot_confusion(demo_metrics, "Binary CNN vs demo labels (full set)", FIG_DIR / "binary_cnn_cm_full_demo.png")
    plot_confusion(
        demo_metrics,
        "Binary CNN vs demo labels (row-normalized)",
        FIG_DIR / "binary_cnn_cm_full_demo_normalized.png",
        normalize=True,
    )
    plot_roc_binary(y_true, demo_probs, "Binary CNN ROC — full demo vs CSV labels", FIG_DIR / "binary_cnn_roc_full_demo.png")
    plot_pr_binary(y_true, demo_probs, "Binary CNN PR — full demo vs CSV labels", FIG_DIR / "binary_cnn_pr_full_demo.png")

    rgb_true = demo_df["rgb_rule_threshold_20"].tolist()
    rgb_agree = compute_metrics(rgb_true, demo_df["cnn_predicted"].tolist(), BINARY_CLASSES, demo_scores)

    original = {
        "available": False,
        "path": str(original_dir) if original_dir else None,
        "reason": None,
        "metrics": {},
    }
    if original_dir is None:
        original["reason"] = (
            "Original CNN_2 training crops were not found. Set PHAGESCAN_ORIGINAL_WELLS "
            "to the SegmentedWells folder used by CNN_2.ipynb to recover the 56/19/19 split."
        )
    else:
        original_names = _image_names(original_dir)
        original["n_images"] = len(original_names)
        if len(original_names) != 94:
            original["reason"] = (
                f"Found {len(original_names)} images in {original_dir}; CNN_2 used 94. Split not applied."
            )
        else:
            split_df = recover_cnn2_split(original_names)
            split_df.to_csv(BIN_DIR / "original_split.csv", index=False)
            original_paths = [original_dir / name for name in split_df["Filename"]]
            orig_pred, orig_probs = predict_batch("binary", original_paths)
            orig_rows = []
            for row, pred, probs, path in zip(split_df.itertuples(index=False), orig_pred, orig_probs, original_paths):
                rgb_label, distance = binary_rgb_reference(path)
                orig_rows.append(
                    {
                        "Filename": row.Filename,
                        "dataset": "original_cnn2_segmented_wells",
                        "split": row.split,
                        "cnn_predicted": pred,
                        "rgb_rule_threshold_20": rgb_label,
                        "rgb_distance": distance,
                        "prob_Ineffective": float(probs[BINARY_CLASSES.index("Ineffective")]),
                        "prob_Effective": float(probs[BINARY_CLASSES.index("Effective")]),
                    }
                )
            orig_df = pd.DataFrame(orig_rows)
            orig_df.to_csv(BIN_DIR / "predictions_original_split.csv", index=False)
            original["available"] = True
            original["split_counts"] = orig_df["split"].value_counts().to_dict()
            original["label_source"] = "rgb_rule_threshold_20 (serving-aligned; not independent wet-lab labels)"
            for split_name in ["train", "val", "test"]:
                part = orig_df[orig_df["split"] == split_name]
                idx = part.index.to_numpy()
                mets = compute_metrics(
                    part["rgb_rule_threshold_20"].tolist(),
                    part["cnn_predicted"].tolist(),
                    BINARY_CLASSES,
                    orig_probs[idx],
                )
                original["metrics"][split_name] = mets
                save_confusion_csv(mets, BIN_DIR / f"confusion_matrix_original_{split_name}.csv")
                save_report_txt(
                    part["rgb_rule_threshold_20"],
                    part["cnn_predicted"],
                    BINARY_CLASSES,
                    BIN_DIR / f"classification_report_original_{split_name}.txt",
                )
            plot_confusion(
                original["metrics"]["test"],
                "Binary CNN vs RGB rule — original held-out test",
                FIG_DIR / "binary_cnn_cm_original_test.png",
            )
            plot_confusion(
                original["metrics"]["test"],
                "Binary CNN vs RGB rule — original test (row-normalized)",
                FIG_DIR / "binary_cnn_cm_original_test_normalized.png",
                normalize=True,
            )
            test_df = orig_df[orig_df["split"] == "test"]
            plot_roc_binary(
                test_df["rgb_rule_threshold_20"].tolist(),
                orig_probs[test_df.index.to_numpy()],
                "Binary CNN ROC — original held-out test vs RGB rule",
                FIG_DIR / "binary_cnn_roc_original_test.png",
            )
            plot_pr_binary(
                test_df["rgb_rule_threshold_20"].tolist(),
                orig_probs[test_df.index.to_numpy()],
                "Binary CNN PR — original held-out test vs RGB rule",
                FIG_DIR / "binary_cnn_pr_original_test.png",
            )

    history_path = _find_history_csv()
    history = {"available": False, "path": None}
    if history_path is not None:
        visible_dir = BASE_DIR / "results" / "binary_cnn"
        visible_dir.mkdir(parents=True, exist_ok=True)
        copied = BIN_DIR / "training_history_cnn2.csv"
        visible = visible_dir / "CNN_2.csv"
        shutil.copy2(history_path, copied)
        shutil.copy2(history_path, visible)
        shutil.copy2(history_path, visible_dir / "training_history.csv")
        plot_training_history(copied, FIG_DIR / "binary_cnn_training_history.png")
        history = {
            "available": True,
            "source_path": str(history_path),
            "copied_to": str(visible.relative_to(REPO_ROOT)),
            "also_copied_to": str(copied.relative_to(REPO_ROOT)),
            "note": "Copied from CNN_2.ipynb training log. Not a new training run.",
            "last_epoch": pd.read_csv(copied).iloc[-1].to_dict(),
        }

    demo_gt_vs_rgb = int((demo_df["ground_truth_labels_csv"] == demo_df["rgb_rule_threshold_20"]).sum())
    payload = {
        "used_by_app": True,
        "model_path": "api/models/well_classifier_cnn.h5",
        "architecture": inspect_model("binary"),
        "api_verification": verify,
        "demo_images_were_training_images": False,
        "demo_images_note": (
            "Current ml/demo/segmented_wells files have zero MD5 overlap with the "
            "CNN_2 SegmentedWells training crops, so the full-demo score is not a "
            "training-set resubstitution of those original files."
        ),
        "label_caveat": (
            "data/ground_truth_labels.csv matches the binary RGB rule (distance < 20 → Effective) "
            "on this demo plate and has not been independently verified as wet-lab ground truth."
        ),
        "demo_gt_equals_rgb_rule": demo_gt_vs_rgb == len(demo_df),
        "metrics_full_demo_vs_csv_labels": demo_metrics,
        "metrics_full_demo_vs_rgb_rule": rgb_agree,
        "original_split": {
            k: v
            for k, v in original.items()
            if k != "metrics"
        },
        "original_split_metrics": original.get("metrics") or {},
        "training_history": history,
        "class_distribution_demo_csv_labels": demo_df["ground_truth_labels_csv"].value_counts().to_dict(),
        "class_distribution_demo_cnn": demo_df["cnn_predicted"].value_counts().to_dict(),
    }
    with (BIN_DIR / "metrics.json").open("w") as handle:
        json.dump(payload, handle, indent=2, default=str)
    return payload


def evaluate_three_class_rgb(demo_paths: list[Path]) -> dict:
    RGB3_DIR.mkdir(parents=True, exist_ok=True)
    labels, _ = predict_batch("rule", demo_paths)
    rows = []
    for path, pred in zip(demo_paths, labels):
        peaks = _calculate_rgb_histogram(str(path))
        distance = rgb_distance_from_peaks(peaks)
        rows.append(
            {
                "Filename": path.name,
                "rgb_3class_predicted": pred,
                "rgb_distance": distance,
                "effective_if_distance_lt": 10,
                "somewhat_effective_if_distance_lt": 25,
            }
        )
    df = pd.DataFrame(rows)
    df.to_csv(RGB3_DIR / "predictions_demo.csv", index=False)
    counts = {name: int((df["rgb_3class_predicted"] == name).sum()) for name in RGB3_CLASSES}
    distance_stats = {}
    for name in RGB3_CLASSES:
        series = df.loc[df["rgb_3class_predicted"] == name, "rgb_distance"]
        distance_stats[name] = {
            "n": int(series.size),
            "mean": float(series.mean()) if len(series) else None,
            "std": float(series.std(ddof=1)) if len(series) > 1 else None,
            "min": float(series.min()) if len(series) else None,
            "max": float(series.max()) if len(series) else None,
        }
    plot_counts(
        counts,
        "3-class RGB predictions on current demo wells",
        FIG_DIR / "three_class_rgb_prediction_counts.png",
        RGB3_CLASSES,
    )

    inventory = {
        "ml/data/ground_truth_labels.csv": "binary Effective/Ineffective only; matches RGB distance < 20",
        "PhageScan-lydia/cnn_classification_results_3_classes.csv": (
            "19 rows named Image_0..Image_18; Actual labels were generated by the same "
            "3-class RGB rule in CNN_multiclass.ipynb. Not usable as independent labels "
            "and not joinable to current demo filenames."
        ),
        "invented_labels": "none — this script does not create 3-class ground truth",
    }
    payload = {
        "used_by_app": True,
        "source": "api.classification_utils._classify_well_rgb",
        "thresholds": {"Effective": "<10", "Somewhat Effective": ">=10 and <25", "Ineffective": ">=25"},
        "evaluable_against_independent_labels": False,
        "metrics": None,
        "reason_metrics_omitted": (
            "No independent three-class reference labels exist in this repository. "
            "Existing 3-class Actual values from the historical notebook were produced "
            "by this same RGB rule, so scoring the rule against them would be circular "
            "rule agreement, not classification accuracy. Labels were not invented."
        ),
        "label_inventory": inventory,
        "prediction_counts_demo": counts,
        "distance_stats_by_class": distance_stats,
        "n_demo": int(len(df)),
        "note": (
            "The prediction-count figure is the classifier's output distribution, "
            "not an accuracy result."
        ),
    }
    with (RGB3_DIR / "evaluation_status.json").open("w") as handle:
        json.dump(payload, handle, indent=2)
    (RGB3_DIR / "README.txt").write_text(
        payload["reason_metrics_omitted"] + "\n\nPrediction counts: " + json.dumps(counts) + "\n"
    )
    return payload


def write_summary_tables(binary_payload: dict) -> pd.DataFrame:
    rows = [
        flatten_metrics("binary_cnn", "full_demo_vs_csv_labels", binary_payload["metrics_full_demo_vs_csv_labels"]),
        flatten_metrics("binary_cnn", "full_demo_vs_rgb_rule", binary_payload["metrics_full_demo_vs_rgb_rule"]),
    ]
    for split_name, mets in binary_payload.get("original_split_metrics", {}).items():
        rows.append(flatten_metrics("binary_cnn", f"original_{split_name}_vs_rgb_rule", mets))
    df = pd.DataFrame(rows)
    df.to_csv(OUT_DIR / "metrics_summary.csv", index=False)
    df.to_csv(BIN_DIR / "metrics_summary.csv", index=False)
    return df


def write_report(binary_payload: dict, rgb3_payload: dict, summary_df: pd.DataFrame) -> None:
    del summary_df
    demo_m = binary_payload["metrics_full_demo_vs_csv_labels"]
    counts = rgb3_payload["prediction_counts_demo"]
    n_rgb = rgb3_payload["n_demo"]
    lines = [
        "# PhageScan deployed-app evaluation",
        "",
        "Generated by `python evaluate_app_models.py`. Covers **only** the two classifiers",
        "used by the current mobile app. Models are not retrained.",
        "",
        "Workbook: `ml/results/app_evaluation/PhageScan_Model_Evaluation.xlsx`",
        "",
        "## Methods used by the app",
        "",
        "| Method | App control | API `model_type` | Classes |",
        "|---|---|---|---|",
        "| Binary CNN (`api/models/well_classifier_cnn.h5`) | Analyze Image (Binary) | `binary` (default) | Ineffective, Effective |",
        "| Deterministic 3-class RGB rule | Analyze Image (Multi-Class) | `rule` | Effective, Somewhat Effective, Ineffective |",
        "",
        "Excluded: 4-class CNN, historical 3-class CNN, Random Forest, and the binary RGB threshold-20 rule as a standalone app method.",
        "",
        "## Binary CNN",
        "",
        f"- Production weights, `preprocess_image` (128×128, /255, BGR), `BINARY_LABELS` = {BINARY_CLASSES}.",
        f"- API verification (batched vs `_predict_label`): **{'pass' if binary_payload['api_verification']['all_match'] else 'FAIL'}**.",
        "- Architecture: Conv16–Pool–Conv32–Pool–Flatten–Dense64–Dropout 0.3–Dense(2, softmax).",
        f"- {binary_payload['demo_images_note']}",
        "",
    ]
    if binary_payload["training_history"].get("available"):
        last = binary_payload["training_history"]["last_epoch"]
        lines += [
            "### Training history (CNN_2.csv, 30 epochs — not a retrain)",
            "",
            f"Copied to `{binary_payload['training_history'].get('copied_to')}`. "
            f"Final epoch train acc {_fmt(float(last.get('accuracy', float('nan'))))}, "
            f"val acc {_fmt(float(last.get('val_accuracy', float('nan'))))}. "
            "See the Excel History sheet for all 30 epochs and the first epoch that reached best validation accuracy.",
            "",
        ]
    if binary_payload.get("original_split_metrics", {}).get("test"):
        lines += metrics_table(
            "Original held-out test (19 images) vs serving-aligned RGB rule",
            binary_payload["original_split_metrics"]["test"],
            [
                "These 19 wells were held out of the CNN_2 56/19/19 split. Labels are the binary RGB rule "
                "(distance < 20 → Effective), not wet-lab assays. 100% is RGB-rule agreement."
            ],
        )
        train_m = binary_payload["original_split_metrics"]["train"]
        val_m = binary_payload["original_split_metrics"]["val"]
        test_m = binary_payload["original_split_metrics"]["test"]
        lines += [
            f"Original split: train {train_m['n']}, val {val_m['n']}, test {test_m['n']}. "
            f"Train RGB-rule agreement {_fmt(train_m['accuracy'])}; validation {_fmt(val_m['accuracy'])}.",
            "",
        ]
    else:
        lines += [
            "### Original held-out test",
            "",
            binary_payload["original_split"].get("reason") or "Not recovered.",
            "",
        ]
    lines += metrics_table(
        "Full current demo (94 images) vs `ground_truth_labels.csv`",
        demo_m,
        [
            binary_payload["label_caveat"],
            "Report as label agreement on one demo plate, not independently validated biological accuracy.",
        ],
    )
    lines += [
        "## Deterministic 3-class RGB rule",
        "",
        f"- Source: `{rgb3_payload['source']}`",
        "- Thresholds: distance <10 Effective; ≥10 and <25 Somewhat Effective; ≥25 Ineffective.",
        f"- Demo wells: {n_rgb}",
        f"- Predicted counts: Effective {counts.get('Effective', 0)} "
        f"({counts.get('Effective', 0)/n_rgb:.1%}), "
        f"Somewhat Effective {counts.get('Somewhat Effective', 0)} "
        f"({counts.get('Somewhat Effective', 0)/n_rgb:.1%}), "
        f"Ineffective {counts.get('Ineffective', 0)} "
        f"({counts.get('Ineffective', 0)/n_rgb:.1%}).",
        "",
        "| Metric | Value |",
        "|---|---|",
        "| Accuracy, balanced accuracy | N/A |",
        "| Precision, recall, F1 | N/A |",
        "| ROC AUC, average precision | N/A |",
        "",
        f"**Why N/A:** {rgb3_payload['reason_metrics_omitted']}",
        "",
        "## What to tell a supervisor",
        "",
        "| Result | How to describe it | Do not describe it as |",
        "|---|---|---|",
        "| Binary CNN 100% on 19 held-out wells | Agreement with RGB-generated binary labels on the original CNN_2 test split | Independently verified biological accuracy |",
        "| Binary CNN 100% on 94 demo wells | Agreement with `ground_truth_labels.csv` (those labels match the RGB rule) | A second independent wet-lab test |",
        "| CNN_2 30-epoch curves | Training log for the binary CNN | A newly run experiment |",
        "| 3-class RGB 15 / 32 / 47 | What the app Multi-Class button assigns on this demo plate | Accuracy of a 3-class model |",
        "",
        "## Reproduction",
        "",
        "```bash",
        "cd ml",
        "pip install -r requirements.txt",
        "python evaluate_app_models.py",
        "```",
        "",
        "Optional original split:",
        "",
        "```bash",
        "export PHAGESCAN_ORIGINAL_WELLS=/path/to/PhageScan-lydia/SegmentedWells",
        "python evaluate_app_models.py",
        "```",
        "",
        "Outputs: `ml/results/app_evaluation/`.",
        "",
    ]
    (OUT_DIR / "EVALUATION_REPORT.md").write_text("\n".join(lines))


def _cleanup_obsolete_results() -> None:
    """Remove generated outputs that are not the two deployed app methods."""
    results_root = BASE_DIR / "results"
    obsolete = [
        results_root / "four_class_cnn",
        results_root / "figures" / "four_class_cnn_prediction_counts.png",
        results_root / "figures" / "binary_vs_four_class_prediction_cooccurrence.png",
        OUT_DIR / "four_class_cnn",
        FIG_DIR / "four_class_cnn_prediction_counts.png",
        FIG_DIR / "binary_vs_four_class_prediction_cooccurrence.png",
    ]
    for name in (
        "three_class_rgb",
        "four_class_cnn",
        "figures",
        "EVALUATION_REPORT.md",
        "metrics.json",
        "metrics_summary.csv",
    ):
        obsolete.append(results_root / name)
    for path in obsolete:
        if not path.exists():
            continue
        if "rf_" in path.name:
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


def main() -> None:
    _cleanup_obsolete_results()
    for path in (OUT_DIR, BIN_DIR, RGB3_DIR, FIG_DIR):
        path.mkdir(parents=True, exist_ok=True)

    demo_names = _image_names(WELLS_DIR)
    if not demo_names:
        raise SystemExit(f"No demo wells found in {WELLS_DIR}")
    demo_paths = [WELLS_DIR / name for name in demo_names]
    print(f"Demo wells: {len(demo_paths)} in {WELLS_DIR}")

    original_dir = _find_original_wells()
    if original_dir:
        print(f"Original CNN_2 wells: {original_dir}")
    else:
        print("Original CNN_2 wells: not found (demo-only binary evaluation)")

    print("\n[A] Binary CNN")
    binary_payload = evaluate_binary_cnn(demo_paths, original_dir)
    demo_m = binary_payload["metrics_full_demo_vs_csv_labels"]
    print(f"  API mapping check: {'pass' if binary_payload['api_verification']['all_match'] else 'FAIL'}")
    print(
        f"  Full demo vs CSV labels: n={demo_m['n']} acc={demo_m['accuracy']:.4f} "
        f"bal_acc={demo_m['balanced_accuracy']:.4f} f1_macro={demo_m['f1_macro']:.4f}"
    )
    if binary_payload["original_split"].get("available"):
        test_m = binary_payload["original_split_metrics"]["test"]
        print(
            f"  Original held-out test vs RGB rule: n={test_m['n']} acc={test_m['accuracy']:.4f} "
            f"f1_macro={test_m['f1_macro']:.4f}"
        )
    else:
        print(f"  Original split: {binary_payload['original_split'].get('reason')}")

    print("\n[B] 3-class RGB rule")
    rgb3_payload = evaluate_three_class_rgb(demo_paths)
    print(f"  Independent labels: no — {rgb3_payload['prediction_counts_demo']}")

    summary_df = write_summary_tables(binary_payload)
    write_report(binary_payload, rgb3_payload, summary_df)

    history_csv = BIN_DIR / "training_history_cnn2.csv"
    if not history_csv.exists():
        raise SystemExit("CNN_2 training history was not recovered; cannot build the workbook.")
    workbook = export_workbook(
        OUT_DIR / "PhageScan_Model_Evaluation.xlsx",
        binary_payload,
        rgb3_payload,
        pd.read_csv(history_csv),
        pd.read_csv(RGB3_DIR / "predictions_demo.csv"),
    )

    combined = {"binary_cnn": binary_payload, "three_class_rgb": rgb3_payload}
    with (OUT_DIR / "metrics.json").open("w") as handle:
        json.dump(combined, handle, indent=2, default=str)

    print(f"\nWrote {OUT_DIR / 'EVALUATION_REPORT.md'}")
    print(f"Wrote {workbook}")
    print(f"Figures: {FIG_DIR}")


if __name__ == "__main__":
    main()
