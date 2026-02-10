# LOOMIVERS PROJECT

## Overview
LOOMIVERS is a single-file HTML5 survival game (Vampire Survivors style) optimized for Android WebView. It features a retro "Voxel/Glitch" aesthetic, persistent meta-progression, and specific mobile optimizations (Touch Controls, Pooling, Offline Ready).

## Development History (Changelog)

### V1: The Foundation
*   **Core Loop:** Player movement (Joystick), Auto-aim/Shoot, XP Collection.
*   **Weapons:** Neon Wand (Rapid), Data Orbit (AOE), Glitch Bomb (Burst).
*   **Enemies:** Swarmers (Follow), Tanks (Slow, High HP).
*   **Tech:** Canvas Rendering, Object Pooling for performance, Android Lifecycle Hooks (`pauseGame`/`resumeGame`).

### V2: Juice & Feedback
*   **Visual Polish:** Screen Shake on hits/explosions, Damage Numbers (Crit Logic), Hit Flash on enemies.
*   **Progression:** Pause-based "Level Up" screen offering 3 random upgrades/weapons.
*   **AI:** "Boids" separation logic to prevent enemies from stacking perfectly on top of each other.
*   **Fixes:** Resolved canvas transform drift issues.

### V3: The Weaver's Glitch (Meta-Game)
*   **The Sanctuary (Hub):** Fully Canvas-based Main Menu (no HTML overlays).
*   **Systems:**
    *   **Wardrobe:** Character Selection screen.
    *   **Upgrade Shop:** Spending currency (Fragments) on permanent stat boosts (HP, Damage, Magnet, Greed).
    *   **Archives:** Bestiary tracking kill counts per enemy type.
    *   **Trophies:** Achievement system (First Blood, Rich, etc.).
*   **Mechanic:** "Glitch Overdrive" (Risk/Reward powerup triggering temporary buffs + permanent difficulty increase).
*   **Persistence:** `localStorage` saves for currency, unlocks, and stats.
*   **Nemesis System:** The enemy that kills you is saved and respawns as a stronger "Crown" enemy in the next run.

### V4: Visual Fidelity
*   **Aesthetics:**
    *   CRT Scanline & Vignette post-processing effects.
    *   Chromatic Aberration on Hit/Overdrive.
    *   Thicker "Voxel" borders (4px) for retro style.
    *   Enhanced Joystick visibility and feedback.
*   **Fixes:** Resolved startup crashes by removing legacy DOM references.

### V5: The Warden Update
*   **Content:**
    *   **Boss:** "The Warden" (Multi-phase behavior, Boss HP Bar).
    *   **New Enemies:** "Glitch Mite" (Fast, Triangle formation), "Data Tank" (Visual trail).
    *   **Projectiles:** Enemy projectile logic (Boss Orbs).
*   **Critical Fixes:**
    *   **Audio:** Global AudioContext resume on first touch (Android compliance).
    *   **Storage:** Deep Merge implementation to prevent save corruption when adding new fields.
    *   **Settings UI:** Replaced toggles with segmented selectors for better mobile UX.

### V6: Code Modularization (Clean Slate)
*   **Refactor:** Complete separation of concerns into ES6 Modules (`game.js`, `entities.js`, `world.js`, `ui.js`, `utils.js`).
*   **Bundling:** Custom Python script (`bundle.py`) to merge modules + CSS into a single HTML file for Android WebView compatibility.
*   **Assets:** Base64 asset injection pipeline (`process_sprites.py`) allowing user-provided sprites without external files.
*   **Fixes:**
    *   Resolved circular dependencies in module loading.
    *   Fixed hitbox alignment issues by centering sprite rendering.
    *   Implemented debounced input handling for UI buttons.

### V7: Infinite Map & Boss Rework
*   **Infinite Map:**
    *   Procedural Chunk Generation (`world.js`) with Perlin-like noise for terrain (Grass, Path, Obstacles).
    *   **Optimization:** Strictly limits rendering to 2 chunks around the player based on screen size (Culling).
    *   **Bug Fixes:** Removed camera clamping to allow infinite scrolling in all directions.
*   **Enemy Logic:**
    *   **Tight Leash:** Enemies respawn just off-screen (Diagonal/2 + 150px) to maintain constant pressure ("Horde" feel).
    *   **Boss Schedule:**
        *   Bosses spawn strictly every 5 minutes (300s, 600s, 900s).
        *   Normal waves resume immediately after boss death.
        *   **The Corruptor (Map Boss):** Spawns at 20 minutes (1200s) with massively increased stats.
*   **UI Polish:**
    *   **Main Menu:** Dynamic layout calculation (`startY`) to prevent button overlap on various screen aspect ratios.
    *   **Offline:** Removed external Google Fonts (`VT323`) in favor of system `monospace` to fix "Internet Error" crashes.
    *   **Credits:** Updated to reflect "Created by Montano Mickael, Founder of Logoloom".

### V8: The Evolution Update (Current Stable)
*   **Gameplay Systems:**
    *   **Combo Logic:** Kill streaks trigger a visual "COMBO xN" display and multiplier.
    *   **Hardcore Mode:** New setting (Title Screen Toggle) that caps Max HP at 1 for the ultimate challenge.
*   **Content:**
    *   **Drone Companion:** New entity that orbits the player and fires automatically at nearest enemies. Unlocked via "Drone Core" upgrade.
    *   **Passive Items:** Added `Spinach`, `Empty Tome`, `Wings`, `Armor` to the level-up pool.
    *   **Corrupted Artifacts:** Rare upgrades with massive buffs and curses (e.g., `Cursed Heart`: +50% Dmg / -50 HP).
    *   **Weapon Evolutions:**
        *   **Holy Beam:** Evolved from `Neon Wand` + `Empty Tome`. Fires piercing high-speed projectiles.
        *   **Cluster Bomb:** Evolved from `Glitch Bomb` + `Spinach`. Explodes into sub-munitions.
        *   **Storm Orbit:** Evolved from `Data Orbit` + `Wings`. Increased rotation speed.
        *   **Rail Turret:** Evolved from `Pixel Rail` + `Drone Core`.

## Roadmap / Remaining Work

### Essential Polish (Current Backlog)
*   [ ] **Visuals:** Add unique sprite for "The Corruptor" (currently reuses Warden).
*   [ ] **Audio:** Add distinct music track for Boss encounters.
*   [ ] **Balance:** Tune "Corruptor" HP scaling based on player feedback (currently 5x base).
*   [ ] **Input:** Add "Hold to Auto-Buy" in Shop for better UX when spending lots of Fragments.

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
