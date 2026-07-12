import os
from pathlib import Path

import cv2
import numpy as np
from tensorflow.keras.models import load_model

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

BINARY_LABELS = ["Ineffective", "Effective"]
MULTICLASS_LABELS = ["Effective", "Ineffective", "Somewhat Effective", "Unknown"]

_model_cache = {}


def preprocess_image(image_path):
    image = cv2.imread(image_path)
    image = cv2.resize(image, (128, 128))
    image = image.astype("float32") / 255.0
    return np.expand_dims(image, axis=0)


def _calc_rgb_peak(histogram):
    return int(np.argmax(histogram.flatten()[1:]))


def _calculate_rgb_histogram(image_path):
    image = cv2.imread(image_path)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    peaks = {}

    for i, color in enumerate(["b", "g", "r"]):
        histogram = cv2.calcHist([image], [i], None, [256], [0, 256])
        peaks[color] = _calc_rgb_peak(histogram)

    return peaks


def _classify_well_rgb(peaks):
    blue_peak = peaks["b"]
    green_peak = peaks["g"]
    red_peak = peaks["r"]
    distance = np.sqrt(
        (blue_peak - green_peak) ** 2
        + (green_peak - red_peak) ** 2
        + (blue_peak - red_peak) ** 2
    )

    if distance < 10:
        return "Effective"
    if distance < 25:
        return "Somewhat Effective"
    return "Ineffective"


def _normalize_model_type(model_type):
    if model_type == "rule":
        return "rule"
    if model_type in {"multiclass", "multi-class", "multi_class"}:
        return "multiclass"
    if model_type == "binary":
        return "binary"
    raise Exception(f'No model of type "{model_type}" found.')


def _get_model(model_type):
    if model_type in _model_cache:
        return _model_cache[model_type]

    if model_type == "binary":
        model_path = MODELS_DIR / "well_classifier_cnn.h5"
    else:
        model_path = MODELS_DIR / "well_classifier_cnn_4_classes.h5"

    _model_cache[model_type] = load_model(model_path)
    return _model_cache[model_type]


def _predict_label(model_type, image_path):
    if model_type == "rule":
        return _classify_well_rgb(_calculate_rgb_histogram(image_path))

    model = _get_model(model_type)
    prediction = model.predict(preprocess_image(image_path), verbose=0)[0]

    if model_type == "binary":
        return BINARY_LABELS[int(np.argmax(prediction))]

    return MULTICLASS_LABELS[int(np.argmax(prediction))]


def classify_images(segmented_images_folder, model_type, rows, columns, radius):
    normalized_model_type = _normalize_model_type(model_type)
    predictions = []
    max_rows = min(len(rows), 8)
    max_columns = min(len(columns), 12)

    for image_name in os.listdir(segmented_images_folder):
        if not image_name.startswith("circle_") or not image_name.endswith((".jpg", ".jpeg", ".png")):
            continue

        try:
            parts = image_name.replace("circle_", "").replace(".png", "").split("_")
            row_index = int(parts[0])
            column_index = int(parts[1])

            if row_index < 1 or row_index > max_rows or column_index < 1 or column_index > max_columns:
                continue

            x = columns[column_index - 1]
            y = rows[row_index - 1]
            image_path = os.path.join(segmented_images_folder, image_name)
            predicted_label = _predict_label(normalized_model_type, image_path)

            predictions.append(
                {
                    "x": x,
                    "y": y,
                    "r": radius,
                    "row": row_index,
                    "column": column_index,
                    "Predicted": predicted_label,
                }
            )
        except (IndexError, ValueError) as e:
            print(f"Skipping file {image_name}: {e}")

    return predictions
