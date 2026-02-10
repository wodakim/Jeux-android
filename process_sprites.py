import os
import base64

def process_sprites(assets_dir):
    data = {}

    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            if file.endswith('.png'):
                # Key construction: ENEMY_SWARMER_WALK1
                # Path: loomivers/assets/enemies/swarmer/walk1.png

                parts = root.split(os.sep)
                # parts might be ['loomivers', 'assets', 'enemies', 'swarmer']

                category = parts[-2].upper() # ENEMIES
                entity = parts[-1].upper()   # SWARMER
                action = file.split('.')[0].upper() # WALK1

                if category == 'ASSETS': # Direct player folder?
                    # loomivers/assets/player -> category=assets, entity=player
                    category = entity # PLAYER
                    key = f"{category}_{action}"
                else:
                    # loomivers/assets/enemies/swarmer -> ENEMIES_SWARMER_WALK1
                    # But we want cleaner keys for game logic mapping
                    # Game uses: 'PLAYER_WALK1', 'SWARMER_WALK1' ??
                    # Let's standarize to ENTITY_ACTION
                    # If folder is 'enemies', map 'swarmer' to 'SWARMER'

                    if category == 'ENEMIES' or category == 'BOSSES':
                         key = f"{entity}_{action}"
                    elif entity == 'PLAYER':
                         key = f"PLAYER_{action}"
                    else:
                         key = f"{entity}_{action}"

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
