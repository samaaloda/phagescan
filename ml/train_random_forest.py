from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent


def calculate_rgb_histogram(image_path):
    image = cv2.imread(str(image_path))
    if image is None:
        return None

    histograms = {}
    for i, color in enumerate(["r", "g", "b"]):
        histogram = cv2.calcHist([image], [i], None, [256], [0, 256])
        histograms[color] = histogram.flatten()

    return histograms


def extract_features(df, folder_path):
    features, labels, filenames = [], [], []

    for _, row in df.iterrows():
        filename = row["Filename"]
        label = str(row["Classification"]).strip().lower()
        path = Path(folder_path) / filename

        if not path.exists():
            continue

        hist = calculate_rgb_histogram(path)
        if hist is None:
            continue

        vec = np.concatenate([hist["r"], hist["g"], hist["b"]])
        vec = vec / np.sum(vec)

        features.append(vec)
        labels.append(1 if label == "effective" else 0)
        filenames.append(filename)

    return np.array(features), np.array(labels), filenames


def train_and_evaluate(
    ground_truth_csv,
    segmented_folder,
    output_csv,
    test_size=0.2,
    random_state=42,
):
    ground_truth = pd.read_csv(ground_truth_csv)
    ground_truth["Classification"] = ground_truth["Classification"].str.strip().str.lower()

    train_df, test_df = train_test_split(
        ground_truth,
        test_size=test_size,
        random_state=random_state,
    )

    X_train, y_train, _ = extract_features(train_df, segmented_folder)
    X_test, y_test, test_filenames = extract_features(test_df, segmented_folder)

    if len(X_train) == 0 or len(X_test) == 0:
        raise RuntimeError("Not enough segmented images found for train/test split")

    model = RandomForestClassifier(n_estimators=100, random_state=random_state)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    results_df = pd.DataFrame(
        {
            "Filename": test_filenames,
            "Actual": ["effective" if y == 1 else "ineffective" for y in y_test],
            "Predicted": ["effective" if p == 1 else "ineffective" for p in y_pred],
        }
    )
    results_df.to_csv(output_csv, index=False)

    report = classification_report(
        results_df["Actual"],
        results_df["Predicted"],
        target_names=["ineffective", "effective"],
    )

    print(report)
    print(f"Saved results to {output_csv}")
    return model, results_df


if __name__ == "__main__":
    train_and_evaluate(
        ground_truth_csv=BASE_DIR / "data" / "ground_truth_labels.csv",
        segmented_folder=BASE_DIR / "demo" / "segmented_wells",
        output_csv=BASE_DIR / "data" / "rf_blind_test_results.csv",
    )
