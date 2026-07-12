from pathlib import Path

import cv2
import numpy as np
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
RGB_THRESHOLD = 20


def calc_peak(histogram):
    return int(np.argmax(histogram.flatten()[1:]))


def calculate_rgb_peaks(image_path):
    image = cv2.imread(str(image_path))
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    peaks = {}

    for i, color in enumerate(["b", "g", "r"]):
        histogram = cv2.calcHist([image], [i], None, [256], [0, 256])
        peaks[color] = calc_peak(histogram)

    return peaks


def classify_well_rgb(peaks, threshold=RGB_THRESHOLD):
    blue_peak = peaks["b"]
    green_peak = peaks["g"]
    red_peak = peaks["r"]
    distance = np.sqrt(
        (blue_peak - green_peak) ** 2
        + (green_peak - red_peak) ** 2
        + (blue_peak - red_peak) ** 2
    )

    if distance < threshold:
        return "Effective"
    return "Ineffective"


def classify_folder(folder_path):
    folder_path = Path(folder_path)
    results = []

    for filename in sorted(folder_path.iterdir()):
        if filename.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue

        peaks = calculate_rgb_peaks(filename)
        results.append(
            {
                "Filename": filename.name,
                "Classification": classify_well_rgb(peaks),
            }
        )

    return pd.DataFrame(results)


if __name__ == "__main__":
    segmented_dir = BASE_DIR / "demo" / "segmented_wells"
    output_csv = BASE_DIR / "data" / "classification_results.csv"

    results_df = classify_folder(segmented_dir)
    results_df.to_csv(output_csv, index=False)
    print(f"Saved {len(results_df)} classifications to {output_csv}")
