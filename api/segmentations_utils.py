import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from pillow_heif import register_heif_opener

register_heif_opener()

BUFFER = 30
MAX_ROWS = 8
MAX_COLUMNS = 12


def _select_best_positions(positions, max_count):
    """Keep at most max_count axis positions, preferring the densest contiguous window."""
    if len(positions) <= max_count:
        return positions

    best_start = 0
    best_span = positions[max_count - 1] - positions[0]
    for start in range(1, len(positions) - max_count + 1):
        span = positions[start + max_count - 1] - positions[start]
        if span < best_span:
            best_span = span
            best_start = start

    return positions[best_start : best_start + max_count]


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

    sorted_circles = sorted(circles, key=lambda c: (c[0], c[1]))
    columns = []
    current_column = []
    previous_x = sorted_circles[0][0]

    for x, y, r in sorted_circles:
        if abs(x - previous_x) <= buffer:
            current_column.append((x, y, r))
        else:
            columns.append(current_column)
            current_column = [(x, y, r)]
        previous_x = x

    if current_column:
        columns.append(current_column)

    row_averages = [int(np.mean([circle[1] for circle in row])) for row in rows]
    column_averages = [int(np.mean([circle[0] for circle in col])) for col in columns]

    row_averages = _select_best_positions(row_averages, MAX_ROWS)
    column_averages = _select_best_positions(column_averages, MAX_COLUMNS)

    radii = [circle[2] for circle in circles]
    average_radius = int(0.8 * sum(radii) / len(radii)) if radii else 0

    return row_averages, column_averages, average_radius


def convert_heic_to_jpg(image_path):
    heic_image = Image.open(image_path)
    jpeg_path = Path(image_path).with_suffix(".jpg")
    heic_image.save(jpeg_path, "JPEG")
    return str(jpeg_path)


def segment_image(image_path, output_folder):
    image_path = Path(image_path)
    if image_path.suffix.lower() == ".heic":
        image_path = Path(convert_heic_to_jpg(image_path))

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"Could not read the image at {image_path}")

    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    circles = cv2.HoughCircles(
        gray_image,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=140,
        param1=29,
        param2=29,
        minRadius=70,
        maxRadius=90,
    )

    if circles is None:
        raise Exception("No circles detected")

    circles = np.uint16(np.around(circles))
    unique_circles = set((i[0], i[1], i[2]) for i in circles[0, :])
    rows, columns, radius = group_circles_by_zone(list(unique_circles), buffer=BUFFER)

    row_index = 1
    column_index = 1

    for y in rows:
        for x in columns:
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

            output_path = os.path.join(output_folder, f"circle_{row_index}_{column_index}.png")
            cv2.imwrite(output_path, circle_with_alpha)
            column_index += 1

        row_index += 1
        column_index = 1

    return rows, columns, radius
