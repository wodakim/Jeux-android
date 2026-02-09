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

### V4: Visual Fidelity & Fixes
*   **Fixes:** Resolved startup crash by removing legacy DOM references and implementing a full Canvas HUD.
*   **Visuals:**
    *   CRT Scanline & Vignette effects.
    *   Chromatic Aberration on Hit/Overdrive.
    *   Thicker "Voxel" borders (4px).
    *   Enhanced Joystick visibility.

### V5: The Warden Update
*   **Critical Fixes:**
    *   **Audio:** Global AudioContext resume on first touch/click (Android compliance).
    *   **Storage:** Implemented Deep Merge to prevent save corruption when adding new settings/stats.
    *   **Settings UI:** Replaced confusing toggles with clear Segmented Selectors.
*   **New Content:**
    *   **Boss:** "The Warden" (Spawns at 2:00, Multi-Phase, Boss HP Bar).
    *   **Enemies:** "Glitch Mite" (Triangle Formation Swarms), "Data Tank" (Visual Trail).
    *   **Projectiles:** Added enemy projectile logic (Boss Orbs).

### V6: Code Modularization & Clean State
*   **Refactor:** Complete separation of concerns into ES6 Modules (`game.js`, `entities.js`, `world.js`, `ui.js`).
*   **Bundling:** Custom Python script to merge modules into a single HTML file for Android.
*   **Assets:** Base64 asset injection pipeline.

### V7: Infinite Map & Boss Rework (Current)
*   **Infinite Map:**
    *   Procedural Chunk Generation (`world.js`) with Perlin-like noise.
    *   **Optimization:** Strictly limits rendering to 2 chunks around the player based on screen size.
    *   **Bug Fixes:** Removed camera clamping to allow infinite scrolling.
*   **Enemy Logic:**
    *   **Tight Leash:** Enemies respawn just off-screen (Diagonal/2 + 150px) to maintain pressure.
    *   **Boss Schedule:**
        *   Boss spawns every 5 minutes (300s).
        *   Normal waves resume after boss death.
        *   **The Corruptor (Map Boss):** Spawns at 20 minutes (1200s) with enhanced stats.
*   **UI Polish:**
    *   **Main Menu:** Dynamic layout calculation to prevent button overlap on various screen sizes.
    *   **Font:** Removed external Google Fonts (`VT323`) in favor of system `monospace` for full offline support.

## Todo / Remaining
*   [ ] **Visual Polish:** Add unique sprite for "The Corruptor".
*   [ ] **Audio:** Add distinct boss music track.
*   [ ] **Balance:** Tune "Corruptor" HP scaling based on player feedback.

## Technical Constraints
1.  **Single File:** All code/css/html in `index.html` (except font imports).
2.  **No External Assets:** Procedural Canvas drawing only (or Base64).
3.  **Mobile First:** Touch controls, Landscape, Performance optimization (Pooling).
4.  **Android Wrapper:** Hardware Acceleration enabled, Immersive Sticky mode.
5.  **Offline Ready:** No external CDNs (Fonts, JS libs).

## Project Structure
*   `loomivers/`: Source code modules.
*   `bundle.py`: Build script.
*   `loomivers_final.html`: The bundled production game file.
*   `android/app/src/main/assets/index.html`: Android asset file (copy of `loomivers_final.html`).
