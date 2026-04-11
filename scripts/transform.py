"""
Standalone script that applies real torchvision transforms.

Reads a JSON request from stdin, writes a JSON response to stdout.

Request format:
{
  "image": "<base64 PNG>",
  "transforms": [
    { "name": "RandomResizedCrop", "params": { "size": 32, "scale_min": 0.08, "scale_max": 1.0 } },
    { "name": "ColorJitter", "params": { "brightness": 0.4, "contrast": 0.4, "saturation": 0.2, "hue": 0.1 } },
    { "name": "Grayscale", "params": { "num_output_channels": 1 } }
  ]
}

Response format:
{ "image": "<base64 PNG>", "crop_rect": { "x": ..., "y": ..., "w": ..., "h": ... } | null }
"""

import sys
import json
import base64
import io

import torch
import torchvision.transforms as T
import torchvision.transforms.functional as F
from PIL import Image


def apply_transforms(image_b64: str, transforms: list[dict]) -> dict:
    # Decode base64 → PIL Image
    img_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    crop_rect = None

    for t in transforms:
        name = t["name"]
        params = t.get("params", {})

        if name == "RandomResizedCrop":
            size = params.get("size", 32)
            scale_min = params.get("scale_min", 0.08)
            scale_max = params.get("scale_max", 1.0)

            # Get the random crop parameters first so we can report the rect
            i, j, h, w = T.RandomResizedCrop.get_params(
                img,
                scale=(scale_min, scale_max),
                ratio=(0.75, 1.33),
            )
            crop_rect = {"x": j, "y": i, "w": w, "h": h}
            img = F.resized_crop(img, i, j, h, w, [size, size])

        elif name == "ColorJitter":
            transform = T.ColorJitter(
                brightness=params.get("brightness", 0.4),
                contrast=params.get("contrast", 0.4),
                saturation=params.get("saturation", 0.2),
                hue=params.get("hue", 0.1),
            )
            img = transform(img)

        elif name == "Grayscale":
            num_output_channels = params.get("num_output_channels", 1)
            transform = T.Grayscale(num_output_channels=num_output_channels)
            img = transform(img)
            # Convert back to RGB for PNG encoding if single-channel
            if num_output_channels == 1:
                img = img.convert("RGB")

        elif name == "Solarize":
            thresh = params.get("threshold", 128)
            img = F.solarize(img, thresh)

        elif name == "HorizontalFlip":
            img = F.hflip(img)

    # Encode result → base64 PNG
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    result_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return {"image": result_b64, "crop_rect": crop_rect}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            result = apply_transforms(req["image"], req["transforms"])
            print(json.dumps(result), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
