import os
from PIL import Image, ImageDraw

def create_placeholder(path, name, width, height, color, text):
    try:
        img = Image.new('RGB', (width, height), color)
        draw = ImageDraw.Draw(img)
        # Simple cross/text
        draw.text((2, 2), text, fill="white")
        draw.rectangle([0, 0, width-1, height-1], outline="white")
        img.save(path)
        print(f"Created {path}")
    except Exception as e:
        print(f"Error creating {path}: {e}")

def create_readme(path, category, width, height, items):
    with open(os.path.join(path, "README.txt"), "w") as f:
        f.write(f"CATEGORY: {category}\n")
        f.write(f"STD DIMENSIONS: {width}x{height} pixels (unless specified)\n")
        f.write("--------------------------------------------------\n")
        f.write("FILES REQUIRED:\n")
        for item in items:
            f.write(f"- {item}.png\n")
        f.write("\nINSTRUCTIONS:\n")
        f.write("Replace these placeholder PNGs with your final pixel art.\n")
        f.write("Keep the filenames exactly as they are.\n")
        f.write("Run 'python3 update_game.py' to update the game.\n")
    print(f"Created README in {path}")

def generate_assets():
    # ... existing logic ...

    # Portal
    path = "loomivers/assets/map/portal"
    items = ["idle", "active"]
    create_readme(path, "Challenge Portal", 64, 64, items)
    create_placeholder(os.path.join(path, "idle.png"), "Portal", 64, 64, "#5500aa", "PORTAL")
    create_placeholder(os.path.join(path, "active.png"), "Active", 64, 64, "#aa00ff", "ACTIVE")

if __name__ == "__main__":
    generate_assets()
