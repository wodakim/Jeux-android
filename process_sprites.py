import os
import base64

def process_sprites(assets_dir):
    data = {}

    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            if file.endswith('.png'):
                # Key construction logic
                # Path: loomivers/assets/map/tiles/grass1.png

                parts = root.split(os.sep)
                # parts might be ['loomivers', 'assets', 'map', 'tiles']

                # Check for known categories based on folder structure
                category = parts[-2].upper() if len(parts) > 2 else ""
                subcat = parts[-1].upper()
                name = file.split('.')[0].upper()

                key = f"{subcat}_{name}" # Default fallback

                # Intelligent Mapping
                if 'ENEMIES' in parts or 'BOSSES' in parts:
                    # loomivers/assets/enemies/swarmer/walk1.png -> SWARMER_WALK1
                    entity = subcat
                    action = name
                    key = f"{entity}_{action}"

                elif 'PLAYER' in parts:
                    key = f"PLAYER_{name}"

                elif 'TILES' in parts:
                    # loomivers/assets/map/tiles/grass1.png -> TILE_GRASS1
                    key = f"TILE_{name}"

                elif 'DECOR' in parts:
                    # loomivers/assets/map/decor/tree1.png -> DECOR_TREE1
                    key = f"DECOR_{name}"

                elif 'ICONS' in parts:
                    # loomivers/assets/ui/icons/weapons/neon_wand.png -> ICON_NEON_WAND
                    # Parent is 'weapons' or 'passives', but unique name is usually enough
                    # Let's prefix ICON_
                    key = f"ICON_{name}"

                elif 'PROJECTILES' in parts:
                    # loomivers/assets/fx/projectiles/p_neon.png -> PROJ_P_NEON (or just PROJ_NEON if we strip p_)
                    if name.startswith('P_'):
                        key = f"PROJ_{name[2:]}"
                    else:
                        key = f"PROJ_{name}"

                with open(os.path.join(root, file), "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                    data[key] = "data:image/png;base64," + encoded_string
                    print(f"Processed {key}")

    # Write to assets_data.js
    with open('loomivers/js/assets_data.js', 'w') as f:
        f.write('export const ASSETS_DATA = {\n')
        for k, v in data.items():
            f.write(f'    "{k}": "{v}",\n')
        f.write('};\n')
    print("Updated loomivers/js/assets_data.js")

if __name__ == "__main__":
    process_sprites('loomivers/assets')
