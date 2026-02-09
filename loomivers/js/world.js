import { ASSETS_DATA } from './assets_data.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

export class World {
    constructor() {
        this.tileSize = 64;
        this.cols = Math.ceil(WORLD_WIDTH / this.tileSize);
        this.rows = Math.ceil(WORLD_HEIGHT / this.tileSize);
        this.grid = []; // 2D array for ground tiles
        this.images = {};
        this.loaded = false;
        this.entities = []; // Stores initial static entities (Trees, Bushes)
    }

    async load() {
        const promises = Object.keys(ASSETS_DATA).map(key => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve();
                };
                img.onerror = reject;
                img.src = ASSETS_DATA[key];
            });
        });
        await Promise.all(promises);
        this.loaded = true;
        this.generate();
    }

    generate() {
        this.grid = [];
        this.entities = [];

        // Simple noise function for natural generation
        // A simple pseudo-random generator based on coordinates would be better for consistency,
        // but Math.random is fine if we generate once at startup.
        // However, we want "patches".
        const noise = (x, y) => {
            return (Math.sin(x * 0.1) + Math.cos(y * 0.1)) * 0.5 + 0.5; // Normalized approx 0-1
        };

        for (let y = 0; y < this.rows; y++) {
            const row = [];
            for (let x = 0; x < this.cols; x++) {
                const wx = x * this.tileSize;
                const wy = y * this.tileSize;

                let tileType = 'GRASS_1';
                // Variation for grass
                if (Math.random() > 0.7) tileType = 'GRASS_2';

                // Path generation (simple sine wave river-like paths)
                const n = noise(x, y);
                if (n > 0.7) {
                    tileType = 'PATH_1';
                    if (Math.random() > 0.5) tileType = 'PATH_2';
                } else if (n > 0.6) {
                    tileType = 'PATH_FLOOR'; // Transition
                }

                row.push(tileType);

                // Decor / Obstacles
                // Don't place on paths
                if (!tileType.includes('PATH')) {
                    const rand = Math.random();
                    // Trees (Clumped)
                    // Use different frequency for trees
                    const treeNoise = (Math.sin(x * 0.3) + Math.cos(y * 0.4));

                    if (treeNoise > 0.5 && rand > 0.7) {
                        // Place Tree (Obstacle)
                         this.entities.push({
                            type: 'TREE',
                            x: wx + 16 + (Math.random() * 10 - 5), // Center in tile somewhat
                            y: wy + 16 + (Math.random() * 10 - 5)
                        });
                    } else if (rand > 0.95) {
                        // Bushes (Decoration)
                        this.entities.push({
                            type: 'BUSH',
                            x: wx + 16 + (Math.random() * 20 - 10),
                            y: wy + 16 + (Math.random() * 20 - 10)
                        });
                    }
                }
            }
            this.grid.push(row);
        }
    }

    render(ctx, cameraX, cameraY, canvasWidth, canvasHeight) {
        if (!this.loaded) return;

        // Calculate visible range (plus buffer)
        // CameraX/Y are usually negative (world moves opposite to camera),
        // wait, in render() usually we translate the context by -cameraX, -cameraY.
        // If the context is ALREADY translated, we draw at world coordinates.
        // In game.js: ctx.translate(Math.floor(cx), Math.floor(cy));
        // cx/cy are negative player position.
        // So the visible world area starts at -cx, -cy.

        // Let's pass the raw camera translation (cx, cy) which are negative.
        // Visible World X range: [-cx, -cx + width]
        // Visible World Y range: [-cy, -cy + height]

        const startX = -cameraX;
        const startY = -cameraY;

        const startCol = Math.floor(startX / this.tileSize);
        const endCol = startCol + (canvasWidth / this.tileSize) + 2;
        const startRow = Math.floor(startY / this.tileSize);
        const endRow = startRow + (canvasHeight / this.tileSize) + 2;

        for (let y = startRow; y < endRow; y++) {
            for (let x = startCol; x < endCol; x++) {
                if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
                    const tile = this.grid[y][x];
                    if (this.images[tile]) {
                        // Draw with floor to avoid gaps
                        // +1 pixel overlap to prevent bleeding lines
                        ctx.drawImage(this.images[tile],
                            Math.floor(x * this.tileSize),
                            Math.floor(y * this.tileSize),
                            this.tileSize + 1,
                            this.tileSize + 1
                        );
                    }
                }
            }
        }
    }
}

export const world = new World();
