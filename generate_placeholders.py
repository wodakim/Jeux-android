import os
from PIL import Image, ImageDraw, ImageFont

def create_placeholder(path, name, width, height, color, text):
    img = Image.new('RGB', (width, height), color)
    draw = ImageDraw.Draw(img)
    # Simple cross/text
    draw.text((5, 5), text, fill="white")
    draw.rectangle([0, 0, width-1, height-1], outline="white")
    img.save(path)
    print(f"Created {path}")

def create_readme(path, name, width, height, frames):
    with open(os.path.join(path, "README.txt"), "w") as f:
        f.write(f"ENTITY: {name}\n")
        f.write(f"DIMENSIONS: {width}x{height} pixels\n")
        f.write("--------------------------------------------------\n")
        f.write("FRAMES REQUIRED:\n")
        for frame in frames:
            f.write(f"- {frame}.png: {width}x{height}\n")
        f.write("\nINSTRUCTIONS:\n")
        f.write("Replace the placeholder PNGs with your own pixel art.\n")
        f.write("Keep the filenames exactly as they are.\n")
        f.write("Run 'python3 process_sprites.py' to update the game.\n")
    print(f"Created README in {path}")

def generate_assets():
    # Player
    p_path = "loomivers/assets/player"
    p_frames = ["stand", "walk1", "walk2", "walk3", "attack1", "attack2", "death"]
    create_readme(p_path, "Player", 48, 48, p_frames)
    for f in p_frames:
        create_placeholder(os.path.join(p_path, f"{f}.png"), "Player", 48, 48, "#00aaaa", f)

    # Enemies
    enemies = [
        ("swarmer", 32, 32, "#aa0000"),
        ("tank", 48, 48, "#550000"),
        ("glitch_mite", 24, 24, "#aaaa00"),
        ("warden", 96, 96, "#aa00aa"),
        ("corruptor", 128, 128, "#550055")
    ]

    for e_name, w, h, col in enemies:
        path = f"loomivers/assets/enemies/{e_name}"
        frames = ["stand", "walk1", "walk2", "walk3", "attack1", "attack2", "death"]
        if e_name in ["warden", "corruptor"]:
            frames += ["special1", "special2", "special3"]

        create_readme(path, e_name.upper(), w, h, frames)
        for f in frames:
            create_placeholder(os.path.join(path, f"{f}.png"), e_name, w, h, col, f)

if __name__ == "__main__":
    generate_assets()
