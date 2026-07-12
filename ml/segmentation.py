import os
from pathlib import Path

import cv2
import numpy as np

BUFFER = 30
BASE_DIR = Path(__file__).resolve().parent


def group_circles_by_zone(circles, buffer=BUFFER):
    sorted_circles = sorted(circles, key=lambda c: (c[1], c[0]))
    rows = []
    current_row = []
    previous_y = sorted_circles[0][1]

    for x, y, r in sorted_circles:
        if abs(y - previous_y) <= buffer:
            current_row.append((x, y, r))
        else:
            rows.append(current_row)
            current_row = [(x, y, r)]
        previous_y = y

    if current_row:
        rows.append(current_row)

    final_grid = []
    for row in rows:
        row_sorted = sorted(row, key=lambda c: c[0])
        columns = []
        current_column = []
        previous_x = row_sorted[0][0]

        for x, y, r in row_sorted:
            if abs(x - previous_x) <= buffer:
                current_column.append((x, y, r))
            else:
                columns.append(current_column)
                current_column = [(x, y, r)]
            previous_x = x

        if current_column:
            columns.append(current_column)

        final_grid.append(columns)

    return final_grid


def segment_wells(image_path, output_folder):
    image_path = Path(image_path)
    output_folder = Path(output_folder)
    output_folder.mkdir(parents=True, exist_ok=True)

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    circles = cv2.HoughCircles(
        gray_image,
        cv2.HOUGH_GRADIENT,
        dp=1.1,
        minDist=140,
        param1=29,
        param2=25,
        minRadius=90,
        maxRadius=100,
    )

    if circles is None:
        raise RuntimeError("No circles detected")

    circles = np.uint16(np.around(circles))
    unique_circles = set((i[0], i[1], i[2]) for i in circles[0, :])
    grouped_circles = group_circles_by_zone(list(unique_circles), buffer=BUFFER)

    saved_paths = []
    row_index = 1
    column_index = 1

    for row in grouped_circles:
        for column in row:
            for x, y, radius in column:
                radius = int(radius * 0.8)

                mask = np.zeros_like(image, dtype=np.uint8)
                cv2.circle(mask, (x, y), radius, (255, 255, 255), -1)
                masked_circle = cv2.bitwise_and(image, mask)

                x_min = max(x - radius, 0)
                x_max = min(x + radius, image.shape[1])
                y_min = max(y - radius, 0)
                y_max = min(y + radius, image.shape[0])
                cropped_circle = masked_circle[y_min:y_max, x_min:x_max]

                alpha_channel = cv2.cvtColor(cropped_circle, cv2.COLOR_BGR2GRAY)
                _, alpha_channel = cv2.threshold(alpha_channel, 1, 255, cv2.THRESH_BINARY)
                b, g, r = cv2.split(cropped_circle)
                circle_with_alpha = cv2.merge([b, g, r, alpha_channel])

                output_path = output_folder / f"circle_{row_index}_{column_index}.png"
                cv2.imwrite(str(output_path), circle_with_alpha)
                saved_paths.append(output_path)

                column_index += 1

        row_index += 1
        column_index = 1

    return saved_paths


if __name__ == "__main__":
    demo_image = BASE_DIR / "demo" / "plate.jpeg"
    output_dir = BASE_DIR / "segmented_output"
    paths = segment_wells(demo_image, output_dir)
    print(f"Saved {len(paths)} segmented wells to {output_dir}")
