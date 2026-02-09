import base64
import os
import sys

def process_images():
    # print("Converting player sprites to Base64...")

    files = {
        'PLAYER_STAND': 'Mage_standby.png',
        'PLAYER_WALK1': 'Mage_walk1.png',
        'PLAYER_WALK2': 'Mage_walk2.png'
    }

    asset_dir = '/tmp/file_attachments'

    js_content = ""

    for key, filename in files.items():
        path = os.path.join(asset_dir, filename)
        if os.path.exists(path):
            with open(path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                js_content += f"    '{key}': 'data:image/png;base64,{encoded_string}',\n"
        else:
            sys.stderr.write(f"Error: File {filename} not found.\n")

    print(js_content)

if __name__ == "__main__":
    process_images()
