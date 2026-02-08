# LOOMIVERS PROJECT

## Overview
LOOMIVERS is a single-file HTML5 survival game (Vampire Survivors style) optimized for Android WebView. It features a retro "Voxel/Glitch" aesthetic, persistent meta-progression, and specific mobile optimizations.

## Versions

### V1: The Foundation
*   Basic Survival Gameplay (Move, Auto-Shoot, Kill, XP).
*   Weapons: Neon Wand, Data Orbit, Glitch Bomb.
*   Enemies: Swarmers, Tanks.
*   Tech: Object Pooling, Android Lifecycle Hooks, Touch Controls.

### V2: Juice & Polish
*   Visuals: Screen Shake, Damage Numbers, Hit Flash, Particles.
*   Progression: Level Up Screen (Pause + 3 Random Cards).
*   AI: Separation logic (Anti-stacking).
*   Fixes: Canvas Transform drift bug.

### V3: The Weaver's Glitch (Meta-Game)
*   **The Sanctuary (Hub):** Canvas-based Main Menu.
*   **Features:** Wardrobe (Skins), Upgrade Shop (Stats), Archives (Bestiary), Trophies.
*   **Mechanic:** "Glitch Overdrive" (Risk/Reward powerup).
*   **Systems:** `localStorage` persistence, Currency (Data Fragments), Nemesis System.
*   **Architecture:** Shifted to 100% Canvas UI (removed HTML overlays).

### V4: Visual Fidelity & Fixes (Current)
*   **Fixes:** Resolved startup crash by removing legacy DOM references and implementing a full Canvas HUD.
*   **Visuals:**
    *   CRT Scanline & Vignette effects.
    *   Chromatic Aberration on Hit/Overdrive.
    *   Thicker "Voxel" borders (4px).
    *   Enhanced Joystick visibility.

## Technical Constraints
1.  **Single File:** All code/css/html in `index.html` (except font imports).
2.  **No External Assets:** Procedural Canvas drawing only.
3.  **Mobile First:** Touch controls, Landscape, Performance optimization (Pooling).
4.  **Android Wrapper:** Hardware Acceleration enabled, Immersive Sticky mode.

## Project Structure
*   `loomivers_v4.html`: The latest source code.
*   `android/`: Android Studio project structure.
    *   `app/src/main/assets/index.html`: The production game file.

## How to Update Android Project
1.  Copy `loomivers_v4.html` to `android/app/src/main/assets/index.html`.
2.  Build & Run in Android Studio.
