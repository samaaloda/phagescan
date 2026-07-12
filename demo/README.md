# Demo Assets

Supplementary demo images for PhageScan.

## Contents

| File | Description |
|------|-------------|
| `image.png` | Sample well plate photograph |

## Usage

This image can be sent to the API for testing:

```bash
curl -X POST "http://127.0.0.1:8000/process/" \
  -F "file=@demo/image.png" \
  -F "model_type=binary"
```

For the primary demo workflow, use the bundled images in:

- `api/demo/test_image.jpeg` — API demo and pytest
- `ml/demo/plate.jpeg` — ML segmentation demo
- `ml/demo/segmented_wells/` — pre-segmented wells (96 PNGs)

See the [root README](../README.md) for full demo instructions.
