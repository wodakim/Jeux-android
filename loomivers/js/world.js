import { ASSETS_DATA } from './assets_data.js';

export class World {
    constructor() {
        this.chunkSize = 512; // 8x8 tiles of 64px
        this.tileSize = 64;
        this.chunks = new Map(); // key: "x,y", value: ChunkData
        this.images = {};
        this.loaded = false;
        this.seed = Math.random() * 10000;
        this.staticObjects = []; // We will fill this dynamically
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
    }

    reset() {
        this.chunks.clear();
        this.staticObjects = [];
        this.seed = Math.random() * 10000;
    }

    // Pseudo-random number generator
    random(x, y) {
        const dot = x * 12.9898 + y * 78.233 + this.seed;
        return (Math.sin(dot) * 43758.5453) % 1;
    }

    noise(x, y) {
        return (Math.sin(x * 0.1 + this.seed) + Math.cos(y * 0.1 + this.seed)) * 0.5 + 0.5;
    }

    getChunk(cx, cy) {
        const key = `${cx},${cy}`;
        if (this.chunks.has(key)) {
            return this.chunks.get(key);
        }

        const chunk = {
            tiles: [],
            objects: []
        };

        const tilesPerChunk = this.chunkSize / this.tileSize;
        const startX = cx * tilesPerChunk;
        const startY = cy * tilesPerChunk;

        for (let y = 0; y < tilesPerChunk; y++) {
            const row = [];
            for (let x = 0; x < tilesPerChunk; x++) {
                const wx = startX + x;
                const wy = startY + y;

                // Map generated keys to standard keys in world.js or update keys here
                // process_sprites produces TILE_GRASS1, TILE_PATH1 etc.
                let tileType = 'TILE_GRASS1';
                if (Math.abs(this.random(wx, wy)) > 0.7) tileType = 'TILE_GRASS2';

                // Path generation
                const n = this.noise(wx, wy);
                if (n > 0.7) {
                    tileType = 'TILE_PATH1';
                    if (Math.abs(this.random(wx, wy * 2)) > 0.5) tileType = 'TILE_PATH2';
                } else if (n > 0.6) {
                    tileType = 'TILE_PATH_FLOOR';
                }

                row.push(tileType);

                // Decor / Obstacles
                if (!tileType.includes('PATH')) {
                    const r = Math.abs(this.random(wx * 3, wy * 3));
                    const treeNoise = (Math.sin(wx * 0.3) + Math.cos(wy * 0.4));

                    const objX = (wx * this.tileSize) + 16 + (Math.abs(this.random(wx, wy)) * 10 - 5);
                    const objY = (wy * this.tileSize) + 16 + (Math.abs(this.random(wy, wx)) * 10 - 5);

                    if (treeNoise > 0.5 && r > 0.7) {
                        chunk.objects.push({
                            type: 'TREE',
                            x: objX,
                            y: objY
                        });
                    } else if (r > 0.95) {
                        chunk.objects.push({
                            type: 'BUSH',
                            x: objX,
                            y: objY
                        });
                    }
                }
            }
            chunk.tiles.push(row);
        }

        this.chunks.set(key, chunk);
        return chunk;
    }

    // Get static objects visible in the camera view for collision
    // This needs to be called by game loop to update staticObjects array
    updateStaticObjects(cameraX, cameraY, width, height) {
        // Clear current static objects as we will repopulate from visible chunks
        // Actually, for collision we need a specific area.
        // We can return a list of objects.

        const startX = -cameraX;
        const startY = -cameraY;

        const startChunkX = Math.floor(startX / this.chunkSize);
        const startChunkY = Math.floor(startY / this.chunkSize);
        // Strict buffer for "2 chunks around" requirement based on screen size
        // We calculate visible range and add a small buffer (1 chunk).
        const endChunkX = Math.floor((startX + width) / this.chunkSize) + 1;
        const endChunkY = Math.floor((startY + height) / this.chunkSize) + 1;

        const objects = [];

        // Automatic screen size verification is implicit in 'width' and 'height' parameters passed from game loop.
        // We only keep chunks within the visible area + buffer.

        const keepKeys = new Set();

        // Iterate visible range + 1 buffer
        for (let cy = startChunkY - 1; cy <= endChunkY + 1; cy++) {
            for (let cx = startChunkX - 1; cx <= endChunkX + 1; cx++) {
                const chunk = this.getChunk(cx, cy);
                objects.push(...chunk.objects);
                keepKeys.add(`${cx},${cy}`);
            }
        }

        // Garbage collection for chunks
        for (const key of this.chunks.keys()) {
            if (!keepKeys.has(key)) {
                this.chunks.delete(key);
            }
        }

        return objects;
    }

    render(ctx, cameraX, cameraY, canvasWidth, canvasHeight) {
        if (!this.loaded) return;

        const startX = -cameraX;
        const startY = -cameraY;

        const startChunkX = Math.floor(startX / this.chunkSize);
        const startChunkY = Math.floor(startY / this.chunkSize);

        const endChunkX = Math.floor((startX + canvasWidth) / this.chunkSize) + 1;
        const endChunkY = Math.floor((startY + canvasHeight) / this.chunkSize) + 1;

        for (let cy = startChunkY; cy <= endChunkY; cy++) {
            for (let cx = startChunkX; cx <= endChunkX; cx++) {
                const chunk = this.getChunk(cx, cy);
                const tilesPerChunk = this.chunkSize / this.tileSize;

                for (let y = 0; y < tilesPerChunk; y++) {
                    for (let x = 0; x < tilesPerChunk; x++) {
                        const tile = chunk.tiles[y][x];

                        const drawX = (cx * this.chunkSize) + (x * this.tileSize);
                        const drawY = (cy * this.chunkSize) + (y * this.tileSize);

                        if (drawX + this.tileSize > startX && drawX < startX + canvasWidth &&
                            drawY + this.tileSize > startY && drawY < startY + canvasHeight) {

                            let img = this.images[tile];
                            if (!img) img = this.images['UI_MISSING']; // Fallback

                            if (img) {
                                ctx.drawImage(img,
                                    Math.floor(drawX),
                                    Math.floor(drawY),
                                    this.tileSize + 1,
                                    this.tileSize + 1
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}

export const world = new World();
