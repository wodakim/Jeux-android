import os
import base64

def process_sprites(assets_dir):
    data = {}

    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            if file.endswith('.png'):
                # Key construction logic

                parts = root.split(os.sep)
                # parts might be ['loomivers', 'assets', 'map', 'tiles']

                # Check for known categories based on folder structure
                subcat = parts[-1].upper()
                name = file.split('.')[0].upper()

                key = f"{subcat}_{name}" # Default fallback

                # Intelligent Mapping
                if 'ENEMIES' in parts or 'BOSSES' in parts:
                    entity = subcat
                    action = name
                    key = f"{entity}_{action}"

                elif 'PLAYER' in parts:
                    key = f"PLAYER_{name}"

                elif 'TILES' in parts:
                    key = f"TILE_{name}"

                elif 'DECOR' in parts:
                    key = f"DECOR_{name}"

                elif 'ICONS' in parts:
                    # loomivers/assets/ui/icons/weapons/neon_wand.png -> ICON_NEON_WAND
                    key = f"ICON_{name}"

                elif 'PROJECTILES' in parts:
                    if name.startswith('P_'):
                        key = f"PROJ_{name[2:]}"
                    else:
                        key = f"PROJ_{name}"

                elif 'MISC' in parts: # UI Misc
                    key = f"UI_{name}"

                elif 'ITEMS' in parts:
                    key = f"ITEM_{name}"

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
