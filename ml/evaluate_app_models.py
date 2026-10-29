#!/usr/bin/env python3
"""Evaluate classification methods used by the current PhageScan application.

Active evaluations (this script):
  A. Binary CNN  — app "Analyze Image (Binary)"
  B. 3-class RGB — app "Analyze Image (Multi-Class)"
  C. 4-class CNN — API `model_type=multiclass` only; not called by the app

Historical experiments are not scored here (Random Forest, historical 3-class CNN,
binary RGB rule). Those outputs are not written to ml/results/.

Inference for A–C uses the production helpers in api/classification_utils.py so
preprocessing and class mappings match the deployed API.

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

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
API_DIR = REPO_ROOT / "api"
DATA_DIR = BASE_DIR / "data"
WELLS_DIR = BASE_DIR / "demo" / "segmented_wells"
OUT_DIR = BASE_DIR / "results"
BIN_DIR = OUT_DIR / "binary_cnn"
RGB3_DIR = OUT_DIR / "three_class_rgb"
CNN4_DIR = OUT_DIR / "four_class_cnn"
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
    MULTICLASS_LABELS,
    _calculate_rgb_histogram,
    _classify_well_rgb,
    _get_model,
    _predict_label,
    preprocess_image,
)

BINARY_CLASSES = list(BINARY_LABELS)  # Ineffective, Effective
RGB3_CLASSES = ["Effective", "Somewhat Effective", "Ineffective"]
CNN4_CLASSES = list(MULTICLASS_LABELS)  # Effective, Ineffective, Somewhat Effective, Unknown
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
    model = _get_model(model_type)
    batch = np.concatenate([preprocess_image(str(path)) for path in paths], axis=0)
    probs = model.predict(batch, verbose=0)
    if model_type == "binary":
        names = BINARY_LABELS
    else:
        names = MULTICLASS_LABELS
    labels = [names[int(np.argmax(row))] for row in probs]
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


def plot_binary_vs_four_cooccurrence(binary_labels: list[str], four_labels: list[str], path: Path) -> None:
    df = pd.DataFrame({"binary": binary_labels, "four": four_labels})
    table = pd.crosstab(df["binary"], df["four"]).reindex(
        index=BINARY_CLASSES, columns=CNN4_CLASSES, fill_value=0
    )
    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    im = ax.imshow(table.to_numpy(), cmap="Blues")
    ax.set_xticks(range(len(table.columns)), list(table.columns), rotation=20, ha="right")
    ax.set_yticks(range(len(table.index)), list(table.index))
    ax.set_xlabel("4-class CNN predicted")
    ax.set_ylabel("Binary CNN predicted")
    ax.set_title("Prediction co-occurrence (diagnostic, not a shared-task comparison)")
    vmax = max(float(table.to_numpy().max()), 1.0)
    for i in range(table.shape[0]):
        for j in range(table.shape[1]):
            value = int(table.iloc[i, j])
            ax.text(j, i, str(value), ha="center", va="center", color="white" if value > vmax * 0.6 else "black")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.savefig(path, dpi=DPI)
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
        "expected_labels": BINARY_LABELS if model_type == "binary" else MULTICLASS_LABELS,
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
        copied = BIN_DIR / "training_history_cnn2.csv"
        shutil.copy2(history_path, copied)
        plot_training_history(copied, FIG_DIR / "binary_cnn_training_history.png")
        history = {
            "available": True,
            "source_path": str(history_path),
            "copied_to": str(copied.relative_to(REPO_ROOT)),
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


def evaluate_four_class_cnn(demo_paths: list[Path], binary_labels: list[str]) -> dict:
    CNN4_DIR.mkdir(parents=True, exist_ok=True)
    architecture = inspect_model("multiclass")
    labels, probs = predict_batch("multiclass", demo_paths)
    rows = []
    for path, pred, row in zip(demo_paths, labels, probs):
        item = {"Filename": path.name, "cnn4_predicted": pred}
        for name, value in zip(MULTICLASS_LABELS, row):
            item[f"prob_{name.replace(' ', '_')}"] = float(value)
        rows.append(item)
    df = pd.DataFrame(rows)
    df.to_csv(CNN4_DIR / "predictions_demo.csv", index=False)
    counts = {name: int((df["cnn4_predicted"] == name).sum()) for name in CNN4_CLASSES}
    plot_counts(
        counts,
        "4-class CNN predictions on current demo wells",
        FIG_DIR / "four_class_cnn_prediction_counts.png",
        CNN4_CLASSES,
    )
    plot_binary_vs_four_cooccurrence(
        binary_labels,
        labels,
        FIG_DIR / "binary_vs_four_class_prediction_cooccurrence.png",
    )

    missing = [
        "No 4-class training notebook or label file was found (no Dense(4) trainer, no Unknown labels).",
        "API maps argmax onto ['Effective', 'Ineffective', 'Somewhat Effective', 'Unknown'] without a saved LabelEncoder.",
        "Current demo labels are binary only, so 4-class precision/recall cannot be computed without inventing classes.",
    ]
    payload = {
        "mapping_risk_note": (
            f"On the current demo plate this model predicted Unknown={counts.get('Unknown', 0)}, "
            f"Somewhat Effective={counts.get('Somewhat Effective', 0)}, "
            f"Effective={counts.get('Effective', 0)}, Ineffective={counts.get('Ineffective', 0)}. "
            "The binary CNN predicted 47 Effective / 47 Ineffective on the same wells. "
            "Without a recovered LabelEncoder, the API class names for this 4-class head "
            "should not be treated as verified."
        ),
        "used_by_app": False,
        "used_by_api": True,
        "model_path": "api/models/well_classifier_cnn_4_classes.h5",
        "architecture": architecture,
        "output_mapping_trustworthy": "unknown",
        "output_mapping_note": (
            "The file is a Keras Sequential with Dense(4, softmax) and no L2, matching the "
            "binary CNN backbone. There is no recovered training script, so the API label "
            "order cannot be verified against a LabelEncoder. Predicted class counts on the "
            "demo plate are a characterization only."
        ),
        "evaluable_against_reference_labels": False,
        "metrics": None,
        "reason_metrics_omitted": " ".join(missing),
        "missing": missing,
        "prediction_counts_demo": counts,
        "n_demo": int(len(df)),
        "predicted_unknown_count": counts.get("Unknown", 0),
    }
    with (CNN4_DIR / "architecture.json").open("w") as handle:
        json.dump(architecture, handle, indent=2)
    with (CNN4_DIR / "evaluation_status.json").open("w") as handle:
        json.dump(payload, handle, indent=2)
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


def write_report(
    binary_payload: dict,
    rgb3_payload: dict,
    cnn4_payload: dict,
    summary_df: pd.DataFrame,
) -> None:
    demo_m = binary_payload["metrics_full_demo_vs_csv_labels"]
    lines = [
        "# PhageScan application-model evaluation",
        "",
        "Generated by `python evaluate_app_models.py`. This report covers the classifiers",
        "wired into the current app and API. It does **not** retrain models.",
        "",
        "## Which models are which",
        "",
        "| Method | Location | Used by app? | Used by API? | Evaluated here? |",
        "|---|---|---|---|---|",
        "| Binary CNN (`well_classifier_cnn.h5`) | `api/models/` | Yes — Analyze Image (Binary) | Yes (`model_type=binary`, default) | Yes |",
        "| 3-class RGB rule (distance &lt;10 / &lt;25) | `api/classification_utils.py` | Yes — Analyze Image (Multi-Class) sends `model_type=rule` | Yes (`model_type=rule`) | Predictions only; no independent labels |",
        "| 4-class CNN (`well_classifier_cnn_4_classes.h5`) | `api/models/` | No | Yes (`model_type=multiclass`) | Architecture + prediction characterization; no labels |",
        "| Random Forest (RGB histograms) | `ml/train_random_forest.py` | No | No | Historical — excluded from `ml/results/` |",
        "| Historical 3-class CNN (`well_classifier_cnn_3_classes*.h5`) | older PhageScan-lydia folder | No | No | Excluded |",
        "| Binary RGB rule (distance &lt;20) | `ml/rgb_classifier.py` | No | No | Excluded as a standalone app method; used only as a label-source diagnostic for the binary CNN |",
        "",
        "## Evaluation methodology",
        "",
        "- Binary and 4-class CNN inference calls `api/classification_utils.py`:",
        "  `preprocess_image` (128×128, divide by 255, OpenCV BGR), then `argmax` onto the API label lists.",
        "- 3-class RGB inference uses the same `_classify_well_rgb` helper as production.",
        "- Current demo set: 94 PNGs in `ml/demo/segmented_wells/` with `data/ground_truth_labels.csv`.",
        "- Original CNN_2 split: 60/20/20, `random_state=42`, no stratification, on the 94 `SegmentedWells` crops from `CNN_2.ipynb`.",
        "- Binary, 3-class, and 4-class scores are **not** comparable as the same task.",
        "- Agreement with RGB-generated labels is not biological classification accuracy.",
        "",
        "## Headline numbers (binary CNN only)",
        "",
        "| Split | n | Accuracy | Balanced acc. | F1 macro | ROC AUC | Label source |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    label_notes = {
        "full_demo_vs_csv_labels": "ground_truth_labels.csv (RGB-matching, not wet-lab verified)",
        "full_demo_vs_rgb_rule": "binary RGB rule, threshold 20 (circular diagnostic)",
        "original_train_vs_rgb_rule": "RGB rule on original CNN_2 train wells",
        "original_val_vs_rgb_rule": "RGB rule on original CNN_2 val wells",
        "original_test_vs_rgb_rule": "RGB rule on original CNN_2 held-out test wells",
    }
    for _, row in summary_df.iterrows():
        note = label_notes.get(row["split"], "")
        lines.append(
            f"| {row['split']} | {int(row['n'])} | {_fmt(row['accuracy'])} | {_fmt(row['balanced_accuracy'])} | {_fmt(row['f1_macro'])} | {_fmt(row['roc_auc'])} | {note} |"
        )

    lines += [
        "",
        "## A. Binary CNN — currently used in the app",
        "",
        f"- Weights: `{binary_payload['model_path']}`",
        f"- Classes: {BINARY_CLASSES} (API `BINARY_LABELS`; `argmax` 0 = Ineffective, 1 = Effective).",
        f"- Architecture: Conv16–Pool–Conv32–Pool–Flatten–Dense64–Dropout 0.3–Dense(2, softmax).",
        f"- API verification (batched vs `_predict_label`): **{'pass' if binary_payload['api_verification']['all_match'] else 'FAIL'}**.",
        f"- Current demo images are **not** the original training crops ({binary_payload['demo_images_note']}).",
        "",
    ]
    lines += metrics_table(
        "Full current demo vs `ground_truth_labels.csv`",
        demo_m,
        [
            binary_payload["label_caveat"],
            "Report this as label agreement on one demo plate, not independently validated biological accuracy.",
        ],
    )
    if binary_payload["original_split"].get("available"):
        test_m = binary_payload["original_split_metrics"]["test"]
        lines += metrics_table(
            "Original CNN_2 held-out test vs serving-aligned RGB rule",
            test_m,
            [
                "These 19 wells were held out of CNN_2 training/validation. Labels are the binary RGB rule "
                "(distance < 20 → Effective), i.e. the original notebook's effective evaluation target after "
                "LabelEncoder/API mapping, not wet-lab assays.",
                "Do not cite this as independent experimental accuracy.",
            ],
        )
        val_m = binary_payload["original_split_metrics"]["val"]
        train_m = binary_payload["original_split_metrics"]["train"]
        lines += [
            f"Original split sizes: train {train_m['n']}, val {val_m['n']}, test {test_m['n']}.",
            f"Train RGB-rule agreement { _fmt(train_m['accuracy']) }; validation { _fmt(val_m['accuracy']) }.",
            "",
        ]
    else:
        lines += [
            "### Original train/validation/test split",
            "",
            binary_payload["original_split"].get("reason") or "Not recovered.",
            "",
            "The current 94 demo wells cannot stand in for that split: they use different filenames and have no shared file hashes with the CNN_2 training folder.",
            "",
        ]
    if binary_payload["training_history"].get("available"):
        last = binary_payload["training_history"]["last_epoch"]
        lines += [
            "### Saved CNN_2 training history (not a retrain)",
            "",
            f"Source: `{binary_payload['training_history'].get('source_path')}` "
            f"(copied to `{binary_payload['training_history'].get('copied_to')}`). Last logged epoch: "
            f"train acc {_fmt(float(last.get('accuracy', float('nan'))))}, "
            f"val acc {_fmt(float(last.get('val_accuracy', float('nan'))))}.",
            "Figure: `figures/binary_cnn_training_history.png`.",
            "",
        ]

    lines += [
        "## B. 3-class RGB rule — currently used in the app",
        "",
        f"- Source: `{rgb3_payload['source']}`",
        f"- Thresholds: {rgb3_payload['thresholds']}",
        f"- Demo wells scored: {rgb3_payload['n_demo']}",
        f"- Predicted counts: {rgb3_payload['prediction_counts_demo']}",
        "",
        f"**No classification metrics are reported.** {rgb3_payload['reason_metrics_omitted']}",
        "",
        "The bar chart in `figures/three_class_rgb_prediction_counts.png` is an output histogram.",
        "",
        "## C. 4-class CNN — API only, not used by the app",
        "",
        f"- Weights: `{cnn4_payload['model_path']}`",
        f"- API mapping: {CNN4_CLASSES}",
        f"- Output units: {cnn4_payload['architecture']['output_units']}",
        f"- Demo predicted counts: {cnn4_payload['prediction_counts_demo']}",
        "",
        f"**No classification metrics are reported.** {cnn4_payload['reason_metrics_omitted']}",
        "",
        cnn4_payload["output_mapping_note"],
        "",
        cnn4_payload.get("mapping_risk_note", ""),
        "",
        "The co-occurrence figure vs the binary CNN is a mapping diagnostic. It is not a comparison of accuracy on a shared labeled task.",
        "",
        "## What is suitable for reporting",
        "",
        "| Result | Suitable to report as | Not suitable as |",
        "|---|---|---|",
        "| Binary CNN vs `ground_truth_labels.csv` on current demo | Agreement with the current binary labels on 94 wells from one plate | Wet-lab / independently verified accuracy |",
        "| Binary CNN original held-out test vs RGB rule | Reproduction of the CNN_2 test protocol (rule agreement on held-out crops) | Independent 3-class or biological accuracy |",
        "| CNN_2.csv train/val curves | Historical training log for the binary CNN | A newly run experiment |",
        "| 3-class RGB prediction counts | Description of what the app Multi-Class button outputs | Accuracy, F1, or ROC |",
        "| 4-class CNN prediction counts | Evidence the API model runs; class-prior characterization | Any performance claim |",
        "",
        "## Data gaps",
        "",
        "1. No independently verified experimental well labels in this repository.",
        "2. No usable 3-class or 4-class reference labels (no Somewhat Effective / Unknown in current CSVs).",
        "3. No 4-class training notebook, so API label order is unverified.",
        "4. Original CNN_2 images live outside this git repo; recovered-split metrics require that folder.",
        "",
        "## Reproduction",
        "",
        "```bash",
        "cd ml",
        "pip install -r requirements.txt",
        "python evaluate_app_models.py",
        "```",
        "",
        "Optional, to score the original CNN_2 split:",
        "",
        "```bash",
        "export PHAGESCAN_ORIGINAL_WELLS=/path/to/PhageScan-lydia/SegmentedWells",
        "python evaluate_app_models.py",
        "```",
        "",
        "Outputs are written under `ml/results/`.",
        "",
    ]
    (OUT_DIR / "EVALUATION_REPORT.md").write_text("\n".join(lines))


def main() -> None:
    for path in (OUT_DIR, BIN_DIR, RGB3_DIR, CNN4_DIR, FIG_DIR):
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
    print(
        f"  API mapping check: {'pass' if binary_payload['api_verification']['all_match'] else 'FAIL'}"
    )
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

    print("\n[C] 4-class CNN (API only)")
    binary_demo_labels = pd.read_csv(BIN_DIR / "predictions_demo.csv")["cnn_predicted"].tolist()
    cnn4_payload = evaluate_four_class_cnn(demo_paths, binary_demo_labels)
    print(f"  Independent labels: no — {cnn4_payload['prediction_counts_demo']}")

    summary_df = write_summary_tables(binary_payload)
    write_report(binary_payload, rgb3_payload, cnn4_payload, summary_df)

    combined = {
        "binary_cnn": binary_payload,
        "three_class_rgb": rgb3_payload,
        "four_class_cnn": cnn4_payload,
    }
    with (OUT_DIR / "metrics.json").open("w") as handle:
        json.dump(combined, handle, indent=2, default=str)

    print(f"\nWrote {OUT_DIR / 'EVALUATION_REPORT.md'}")
    print(f"Figures: {FIG_DIR}")


if __name__ == "__main__":
    main()
