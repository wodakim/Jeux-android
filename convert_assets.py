import os
import base64

def convert_assets():
    print("Converting assets to Base64...")

    asset_dir = '/tmp/file_attachments'
    output_path = 'loomivers/js/assets_data.js'

    # Mapping friendly names to file names
    files = {
        'GRASS_1': 'grass1.png',
        'GRASS_2': 'grass2.png',
        'TREE_1': 'three1.png',
        'BUSH_1': 'grass_brush1.png',
        'BUSH_2': 'grass_brush2.png',
        'PATH_1': 'grass_path1.png',
        'PATH_2': 'grass_path2.png',
        'PATH_FLOOR': 'grass_floorpath1.png'
    }

    js_content = "export const ASSETS_DATA = {\n"

    for key, filename in files.items():
        path = os.path.join(asset_dir, filename)
        if os.path.exists(path):
            with open(path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                # Determine mime type (assume png for now as provided)
                mime = "image/png"
                js_content += f"    '{key}': 'data:{mime};base64,{encoded_string}',\n"
        else:
            print(f"WARNING: File {filename} not found in {asset_dir}")

    js_content += "};\n"

    with open(output_path, 'w') as f:
        f.write(js_content)

    print(f"Assets converted and saved to {output_path}")

if __name__ == "__main__":
    convert_assets()
