# LOOMIVERS PROJECT

## Overview
LOOMIVERS is a single-file HTML5 survival game (Vampire Survivors style) optimized for Android WebView. It features a retro "Voxel/Glitch" aesthetic, persistent meta-progression, and specific mobile optimizations.

## Development History (Changelog)

### V1-V6: Foundations
*   Basic Survival Gameplay, Weapons, Enemies, Meta-Game (Shop/Wardrobe), Visual Polish (CRT/Shake).
*   Modular Codebase Refactor.

### V7: Infinite Map & Boss Rework
*   Procedural Chunk Generation (`world.js`).
*   Infinite scrolling (removed camera clamping).
*   Strict Boss Schedule (5min intervals).

### V8: The Evolution Update
*   **Gameplay Systems:** Combo Logic & Hardcore Mode (1 HP).
*   **Content:** Drone Companion, Passive Items, Corrupted Artifacts, Weapon Evolutions.

### V9: Polish & Assets (Current Stable)
*   **Asset Pipeline:**
    *   Migrated to a directory-based asset structure (`loomivers/assets/`).
    *   Added placeholders for **everything**: Map Tiles, Decor, Items, UI Icons, Projectiles, and all Entities.
    *   Implemented `generate_placeholders.py` to create standard sprite templates.
    *   Implemented `process_sprites.py` to bake assets into `assets_data.js` as Base64.
*   **Animations:**
    *   Added support for 3-frame walk cycles (Walk1-3) and Attack states in `entities.js`.
*   **Audio:**
    *   Implemented Dynamic Music ("Boss Mode") with pitch shift/tempo increase.
*   **Balance:**
    *   Implemented Boss HP Scaling based on game time (+100% every 5 min).
*   **UI/HUD:**
    *   Redesigned HUD for better mobile readability (Top-Left Stats, Top-Right Combo, Bottom-Center HP, Bottom-Edge XP).

## Roadmap / Remaining Work

### Essential Polish (Backlog)
*   [ ] **Visuals:** Replace placeholder assets with final Pixel Art.
*   [ ] **Audio:** Add distinct sound effects for new weapons (Evolutions).
*   [ ] **Input:** Add "Hold to Auto-Buy" in Shop.

### Proposed V10 Features
1.  **Pet Evolution:** Upgrade the basic Drone into specialized types (Healer, Gunner, Looter) via further upgrades.
2.  **Challenge Rooms:** Spawn portal gates that lead to small timed arenas with specific modifiers (e.g., "No Weapons, only Dash").
3.  **Daily Run:** A fixed seed run with a specific character/loadout, refreshing every 24h, with its own leaderboard.
4.  **Bestiary 2.0:** Expand the Archives to include detailed stats, lore text, and a rotatable model viewer for each enemy.
5.  **Secret Boss (The Architect):** A hidden boss that only spawns if you perform a specific ritual or reach a glitched area of the map.

## Technical Constraints
1.  **Single File:** All code/css/html in `index.html` (except font imports).
2.  **No External Assets:** Procedural Canvas drawing only (or Base64).
3.  **Mobile First:** Touch controls, Landscape, Performance optimization (Pooling).
4.  **Android Wrapper:** Hardware Acceleration enabled, Immersive Sticky mode.
5.  **Offline Ready:** No external CDNs (Fonts, JS libs).

## Project Structure
*   `loomivers/`: Source code modules.
    *   `assets/`: Source PNG files organized by category.
    *   `js/`: Game logic.
*   `generate_placeholders.py`: Creates dummy assets.
*   `process_sprites.py`: Compiles PNGs to `assets_data.js`.
*   `bundle.py`: Build script -> `loomivers_final.html`.
