#!/usr/bin/env python3
"""
Create a minimal test image for E2E payment proof upload.
Run from front-end root: python e2e/create_test_image.py
Requires: pip install Pillow
"""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow first: pip install Pillow")

def main():
    assets = Path(__file__).resolve().parent / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    jpg_path = assets / "test-payment-proof.jpg"
    img = Image.new("RGB", (50, 50), color=(200, 200, 200))
    img.save(jpg_path, "JPEG", quality=85)
    print(f"Created: {jpg_path}")

if __name__ == "__main__":
    main()
