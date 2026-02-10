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
        f.write("Run 'python3 process_sprites.py' to update the game.\n")
    print(f"Created README in {path}")

def generate_assets():
    # 1. Player & Enemies (Already done, skipped)

    # 2. Map Tiles
    path = "loomivers/assets/map/tiles"
    items = ["grass1", "grass2", "path1", "path2", "path_floor"]
    create_readme(path, "Map Tiles", 64, 64, items)
    for i in items:
        create_placeholder(os.path.join(path, f"{i}.png"), "Tile", 64, 64, "#228822", i)

    # 3. Map Decor
    path = "loomivers/assets/map/decor"
    items = ["tree1", "bush1", "bush2"]
    create_readme(path, "Map Decor", 64, 64, items)
    create_placeholder(os.path.join(path, "tree1.png"), "Tree", 64, 96, "#442200", "TREE")
    create_placeholder(os.path.join(path, "bush1.png"), "Bush", 48, 48, "#22aa22", "BUSH1")
    create_placeholder(os.path.join(path, "bush2.png"), "Bush", 48, 48, "#22aa22", "BUSH2")

    # 4. UI Icons - Weapons
    path = "loomivers/assets/ui/icons/weapons"
    items = ["neon_wand", "glitch_bomb", "pixel_rail", "void_axe", "force_field", "data_orbit"]
    create_readme(path, "Weapon Icons", 32, 32, items)
    for i in items:
        create_placeholder(os.path.join(path, f"{i}.png"), "Icon", 32, 32, "#555555", i[:4])

    # 5. UI Icons - Passives
    path = "loomivers/assets/ui/icons/passives"
    items = ["might", "haste", "speed", "armor", "drone_module", "cursed_heart", "glass_cannon", "heal"]
    create_readme(path, "Passive Icons", 32, 32, items)
    for i in items:
        create_placeholder(os.path.join(path, f"{i}.png"), "Icon", 32, 32, "#333388", i[:4])

    # 6. FX Projectiles
    path = "loomivers/assets/fx/projectiles"
    items = ["p_neon", "p_orb", "p_axe", "p_rail", "p_bomb"]
    create_readme(path, "Projectiles", 16, 16, items)
    create_placeholder(os.path.join(path, "p_neon.png"), "Proj", 16, 16, "#00ffff", "N")
    create_placeholder(os.path.join(path, "p_orb.png"), "Proj", 16, 16, "#ff00ff", "O")
    create_placeholder(os.path.join(path, "p_axe.png"), "Proj", 32, 32, "#aa0000", "AXE")
    create_placeholder(os.path.join(path, "p_rail.png"), "Proj", 8, 32, "#ffff00", "|")
    create_placeholder(os.path.join(path, "p_bomb.png"), "Proj", 24, 24, "#00ff00", "B")

    # 7. UI Misc (Joystick, etc)
    path = "loomivers/assets/ui/misc"
    items = ["joystick_base", "joystick_stick", "button_normal", "button_pressed", "panel_bg"]
    create_readme(path, "UI Misc", 64, 64, items)
    create_placeholder(os.path.join(path, "joystick_base.png"), "JoyBase", 128, 128, "#222222", "BASE")
    create_placeholder(os.path.join(path, "joystick_stick.png"), "JoyStick", 64, 64, "#00aaaa", "STICK")
    create_placeholder(os.path.join(path, "button_normal.png"), "Btn", 128, 48, "#444444", "BTN")
    create_placeholder(os.path.join(path, "button_pressed.png"), "BtnP", 128, 48, "#222222", "BTN_P")
    create_placeholder(os.path.join(path, "panel_bg.png"), "Panel", 256, 256, "#111111", "PANEL")

    # 8. Items (Gems, Chests)
    path = "loomivers/assets/items"
    items = ["gem_xp", "gem_data", "chest_closed", "chest_open"]
    create_readme(path, "Items", 32, 32, items)
    create_placeholder(os.path.join(path, "gem_xp.png"), "XP", 16, 16, "#0000aa", "XP")
    create_placeholder(os.path.join(path, "gem_data.png"), "DATA", 16, 16, "#00aa00", "DATA")
    create_placeholder(os.path.join(path, "chest_closed.png"), "Chest", 32, 32, "#884400", "CHEST")
    create_placeholder(os.path.join(path, "chest_open.png"), "ChestO", 32, 32, "#884400", "OPEN")

if __name__ == "__main__":
    generate_assets()
