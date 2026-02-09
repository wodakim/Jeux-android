import re
import os

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def bundle():
    print("Bundling Loomivers into single HTML file...")

    # Read parts
    css = read_file('loomivers/css/style.css')

    # Read JS modules
    js_modules = [
        'loomivers/js/constants.js',
        'loomivers/js/assets_data.js',
        'loomivers/js/utils.js',
        'loomivers/js/world.js',
        'loomivers/js/audio.js',
        'loomivers/js/ui.js',
        'loomivers/js/entities.js',
        'loomivers/js/game.js'
    ]

    combined_js = ""

    # Pre-declare variables that are circular dependencies
    combined_js += "let sceneManager;\n"

    for path in js_modules:
        content = read_file(path)

        # Remove imports
        content = re.sub(r'^import .*;\n?', '', content, flags=re.MULTILINE)

        # Remove exports (keep the declaration)
        content = re.sub(r'^export (const|class|function|let|var) ', r'\1 ', content, flags=re.MULTILINE)
        content = re.sub(r'^export default ', '', content, flags=re.MULTILINE)
        content = re.sub(r'^export \{.*\}', '', content, flags=re.MULTILINE) # Handle named exports at end if any

        # Handle sceneManager specifically
        if 'game.js' in path:
            # Change "export const sceneManager =" to "sceneManager ="
            content = content.replace('const sceneManager =', 'sceneManager =')

            # Remove the "window.fireWeaponGlobal" if I want it clean, but it's fine.

        combined_js += f"\n// --- SOURCE: {path} ---\n"
        combined_js += content
        combined_js += "\n"

    # Read Index Template
    # We'll create a fresh HTML structure based on loomivers/index.html but injecting CSS/JS

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>LOOMIVERS V8 FINAL</title>
    <style>
{css}
    </style>
</head>
<body>
    <canvas id="gameCanvas"></canvas>
    <script>
{combined_js}
    </script>
</body>
</html>"""

    with open('loomivers_final.html', 'w') as f:
        f.write(html_content)

    print("Bundle complete: loomivers_final.html")

if __name__ == "__main__":
    bundle()
