import os

def merge():
    with open('loomivers/js/assets_data.js', 'r') as f:
        original_js = f.read()

    with open('player_sprites_b64.txt', 'r') as f:
        new_sprites = f.read()

    # We expect original_js to end with "};\n" or "};"
    # We want to insert the new sprites before the last closing brace

    last_brace_index = original_js.rfind('}')

    if last_brace_index != -1:
        new_js = original_js[:last_brace_index] + new_sprites + original_js[last_brace_index:]

        with open('loomivers/js/assets_data.js', 'w') as f:
            f.write(new_js)
        print("Merged assets successfully.")
    else:
        print("Error: Could not find closing brace in assets_data.js")

if __name__ == "__main__":
    merge()
