import os
import subprocess
import sys

def run_script(script_name):
    print(f"--- Running {script_name} ---")
    try:
        result = subprocess.run([sys.executable, script_name], check=True, text=True)
        if result.returncode == 0:
            print(f"Successfully ran {script_name}")
        else:
            print(f"Error running {script_name}")
    except Exception as e:
        print(f"Failed to run {script_name}: {e}")

def main():
    print("Updating LOOMIVERS...")

    # 1. Update Asset Data (PNG -> Base64)
    run_script('process_sprites.py')

    # 2. Bundle Game (Modules -> Single HTML)
    run_script('bundle.py')

    print("\n---------------------------------------------------")
    print("SUCCESS! 'loomivers_final.html' has been updated.")
    print("You can now open it in Chrome/Android Studio.")
    print("---------------------------------------------------")

if __name__ == "__main__":
    main()
