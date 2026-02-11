import os
from PIL import Image, ImageDraw

def create_missing_texture():
    # 32x32 Magenta/Black checkerboard
    img = Image.new('RGB', (32, 32), "#ff00ff")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 16, 16], fill="black")
    draw.rectangle([16, 16, 32, 32], fill="black")
    img.save("loomivers/assets/ui/misc/missing.png")
    print("Created missing texture")

if __name__ == "__main__":
    create_missing_texture()
