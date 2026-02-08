# LOOMIVERS Android Wrapper

This directory contains the source code for the Android wrapper of the LOOMIVERS game.

## Project Structure

- `app/src/main/assets/index.html`: The complete game file.
- `app/src/main/java/com/loomivers/game/MainActivity.java`: The native Java activity that runs the WebView.
- `app/src/main/AndroidManifest.xml`: The configuration file.

## How to Import into Android Studio

1.  Open Android Studio.
2.  Select **File > New > New Project**.
3.  Choose **No Activity** and click **Next**.
4.  Set **Name** to `LOOMIVERS` and **Package name** to `com.loomivers.game`.
5.  Set **Language** to `Java`.
6.  Click **Finish**.

### Copying Files

Once the project is created:

1.  **AndroidManifest.xml**:
    - Replace the contents of `app/src/main/AndroidManifest.xml` with the provided file in this repo.
    - Ensure the package name matches if you changed it.

2.  **MainActivity.java**:
    - Copy `MainActivity.java` to `app/src/main/java/com/loomivers/game/`.
    - If you used a different package name, update the `package` line at the top of the file.

3.  **Assets**:
    - Create a folder `app/src/main/assets` (Right-click `app/src/main` > New > Folder > Assets Folder).
    - Copy your `index.html` (the game file) into this folder.

### Running the App

1.  Connect your Android device or start an Emulator.
2.  Click **Run > Run 'app'**.
3.  Enjoy LOOMIVERS in full screen!

## Configuration

- **Orientation**: Forced to Landscape in `AndroidManifest.xml`.
- **Immersive Mode**: The game runs in full screen without status bars.
- **Hardware Acceleration**: Enabled for smooth Canvas performance.
