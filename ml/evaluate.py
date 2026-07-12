from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent


def evaluate_predictions(predictions_csv, ground_truth_csv, output_csv):
    predictions_df = pd.read_csv(predictions_csv)
    ground_truth_df = pd.read_csv(ground_truth_csv)

    merged_df = pd.merge(predictions_df, ground_truth_df, on="Filename", how="inner")
    merged_df["Correct"] = (
        merged_df["Classification_x"].str.strip().str.lower()
        == merged_df["Classification_y"].str.strip().str.lower()
    )

    accuracy = merged_df["Correct"].mean()
    merged_df.to_csv(output_csv, index=False)

    print(f"Matched wells: {len(merged_df)}")
    print(f"Accuracy: {accuracy:.2%}")
    print(f"Saved merged results to {output_csv}")
    return merged_df


if __name__ == "__main__":
    evaluate_predictions(
        predictions_csv=BASE_DIR / "data" / "classification_results.csv",
        ground_truth_csv=BASE_DIR / "data" / "ground_truth_labels.csv",
        output_csv=BASE_DIR / "data" / "merged_results_with_accuracy.csv",
    )
