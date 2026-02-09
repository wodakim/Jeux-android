import { GameData } from './utils.js';
import { UI } from './ui.js';
import { audioController } from './audio.js';
import { world } from './world.js';
import { player, enemyPool, projectilePool, gemPool, particlePool, damageTextPool, spawnGem, spawnParticle, spawnDamageText, staticObjects, StaticObject } from './entities.js';
import { CHARACTERS, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

// --- GAME LOGIC ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

let currentScene = 'BOOT';
let lastTime = 0;
let score = 0;
let gameTime = 0;
let spawnTimer = 0;
let waveTimer = 0;
let corruptionLevel = 0;
let bossSpawned = false;
let nemesisSpawned = false;
let shakeIntensity = 0;
let storyY = 0;
let activeUpgradeChoices = [];
let selectedCharacter = 'WEAVER';

// Input Handler
class InputHandler {
    constructor() {
        this.joystick = { x: 0, y: 0, active: false, originX: 0, originY: 0 };
        this.keys = {};
        this.taps = [];
        this.lastTouchTime = 0;
        this.setupTouch();
        this.setupKeyboard();
    }

    setupTouch() {
        document.addEventListener('touchstart', (e) => {
            this.lastTouchTime = Date.now();
            const touch = e.changedTouches[0];
            if (currentScene !== 'PLAYING') {
                this.taps.push({ x: touch.clientX, y: touch.clientY });
                return;
            }
            if (this.isValidJoystickZone(touch.clientX, window.innerWidth)) {
                this.joystick.active = true;
                this.joystick.originX = touch.clientX;
                this.joystick.originY = touch.clientY;
                this.joystick.x = 0;
                this.joystick.y = 0;
            }
            this.taps.push({ x: touch.clientX, y: touch.clientY });
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (currentScene !== 'PLAYING' || !this.joystick.active) return;
            e.preventDefault();
            const touch = e.changedTouches[0];
            const dx = touch.clientX - this.joystick.originX;
            const dy = touch.clientY - this.joystick.originY;
            const distance = Math.sqrt(dx*dx + dy*dy);
            let size = 50;
            if (GameData.settings.joystickSize === 'Small') size = 30;
            if (GameData.settings.joystickSize === 'Large') size = 70;
            const maxRadius = size;
            if (distance > 0) {
                const angle = Math.atan2(dy, dx);
                const clampedDist = Math.min(distance, maxRadius);
                this.joystick.x = (Math.cos(angle) * clampedDist) / maxRadius;
                this.joystick.y = (Math.sin(angle) * clampedDist) / maxRadius;
            }
        }, { passive: false });

        document.addEventListener('touchend', () => {
            this.joystick.active = false;
            this.joystick.x = 0;
            this.joystick.y = 0;
        });

        document.addEventListener('mousedown', (e) => {
             // Debounce: Ignore mouse events if touch events were triggered recently (500ms)
             if (Date.now() - this.lastTouchTime < 500) return;
             this.taps.push({ x: e.clientX, y: e.clientY });
        });
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') this.taps.push({ x: 0, y: 0, key: 'Space' });
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    getMovementVector() {
        let dx = 0, dy = 0;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
        if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            return { x: dx / len, y: dy / len };
        }
        return { x: this.joystick.x, y: this.joystick.y };
    }

    isValidJoystickZone(x, width) {
        return (GameData.settings.joystickSide === 'Left') ? x < width / 2 : x > width / 2;
    }

    checkTap(rect) {
        for (let i = 0; i < this.taps.length; i++) {
            const t = this.taps[i];
            if (t.x >= rect.x && t.x <= rect.x + rect.w && t.y >= rect.y && t.y <= rect.y + rect.h) return true;
        }
        return false;
    }

    clearTaps() { this.taps = []; }
}
const input = new InputHandler();

// Scene Manager
export const sceneManager = {
    bootTimer: 0,
    changeScene(name) {
        currentScene = name;
        input.clearTaps();
    },
    addShake(amount) {
        shakeIntensity = Math.min(shakeIntensity + amount, 20);
    },
    increaseCorruption() { corruptionLevel++; },
    addScore(val) { score += val; },
    recordKill(type) {
        if (!GameData.progress.bestiary[type]) GameData.progress.bestiary[type] = 0;
        GameData.progress.bestiary[type]++;
        GameData.saveProgress();
    },
    onBossDeath() {
        bossSpawned = false;
        // Resume wave timer or spawn logic if needed immediately,
        // but updating bossSpawned to false will allow spawnTimer to trigger spawns again in updateGame.
        // Maybe add some score or visual feedback here too?
        sceneManager.addScore(1000);
        spawnDamageText("WARDEN DEFEATED!", player.x, player.y - 100);
    },
    endGame() { endGameLogic(); },
    triggerLevelUpScreen() { triggerLevelUpScreenLogic(); }
};

// Resize
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// --- GLOBAL WEAPON LOGIC ---
window.fireWeaponGlobal = function(p, w) {
    let nearest = null, minDist = Infinity;
    // Find nearest enemy center to player center
    const pCx = p.x + p.width/2;
    const pCy = p.y + p.height/2;

    for (const e of enemyPool.active) {
        const eCx = e.x + e.width/2;
        const eCy = e.y + e.height/2;
        const dx = eCx - pCx;
        const dy = eCy - pCy;
        const dist = dx*dx + dy*dy;
        if (dist < minDist) { minDist = dist; nearest = e; }
    }

    const dmg = w.damage * p.damageMult;
    const count = w.projectiles || 1;

    if (w.type === 'NEON_WAND') {
        if (nearest && minDist < 400*400) {
            for(let i=0; i<count; i++) {
                const spread = (i - (count-1)/2) * 20;
                // Target center of enemy
                const tx = nearest.x + nearest.width/2 + spread;
                const ty = nearest.y + nearest.height/2 + spread;
                projectilePool.get().init('NEON_WAND', pCx, pCy, tx, ty, dmg);
            }
            w.cooldown = w.fireRate * p.fireRateMult;
        }
    } else if (w.type === 'GLITCH_BOMB') {
        for(let i=0; i<count; i++) {
            let tx, ty;
            if (enemyPool.active.length > 0) {
                const r = enemyPool.active[Math.floor(Math.random() * enemyPool.active.length)];
                tx = r.x + r.width/2; ty = r.y + r.height/2;
            } else {
                const a = Math.random() * Math.PI * 2;
                tx = pCx + Math.cos(a)*200; ty = pCy + Math.sin(a)*200;
            }
            projectilePool.get().init('GLITCH_BOMB', pCx, pCy, tx, ty, dmg);
        }
        w.cooldown = w.fireRate * p.fireRateMult;
    } else if (w.type === 'PIXEL_RAIL') {
        if (nearest) {
            // Shoots straight at nearest, infinite speed/ray essentially but implemented as fast projectile
            projectilePool.get().init('PIXEL_RAIL', pCx, pCy, nearest.x + nearest.width/2, nearest.y + nearest.height/2, dmg);
            w.cooldown = w.fireRate * p.fireRateMult;
        }
    } else if (w.type === 'VOID_AXE') {
        // Throws axe towards nearest or random
        let tx = pCx + 100, ty = pCy;
        if (nearest) { tx = nearest.x + nearest.width/2; ty = nearest.y + nearest.height/2; }
        projectilePool.get().init('VOID_AXE', pCx, pCy, tx, ty, dmg);
        w.cooldown = w.fireRate * p.fireRateMult;
    } else if (w.type === 'FORCE_FIELD') {
        // Area damage around player
        createExplosion(pCx, pCy, dmg, 150);
        w.cooldown = w.fireRate * p.fireRateMult;
    }
};

export function createExplosion(x, y, damage, range = 100) {
    // sceneManager.addShake(15); // Disabled per user request
    for (const e of enemyPool.active) {
        const dx = (e.x + e.width/2) - x;
        const dy = (e.y + e.height/2) - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < range) e.takeDamage(damage, 300, x, y, true); // Pass isCrit=true for explosion/heavy hits
    }
    const pCount = GameData.settings.particles === 'High' ? 20 : 5;
    for(let i=0; i<pCount; i++) spawnParticle(x + (Math.random()-0.5)*range, y + (Math.random()-0.5)*range, '#ff0');
}

function endGameLogic() {
    sceneManager.changeScene('GAME_OVER');
    if (score > GameData.progress.highScore) GameData.progress.highScore = score;
    if (enemyPool.active.length > 0) {
        const killer = enemyPool.active[0];
        GameData.progress.nemesis = { type: killer.type, hp: killer.hp, damage: 10, color: killer.color };
    }
    GameData.saveProgress();
}

function triggerLevelUpScreenLogic() {
    sceneManager.changeScene('LEVEL_UP');
    input.clearTaps();
    const possibleUpgrades = [
        { id: 'NEON_WAND', title: 'Neon Wand', desc: 'New Weapon / +Damage' },
        { id: 'DATA_ORBIT', title: 'Data Orbit', desc: 'New Weapon / +Speed' },
        { id: 'GLITCH_BOMB', title: 'Glitch Bomb', desc: 'New Weapon / +Damage' },
        { id: 'PIXEL_RAIL', title: 'Pixel Rail', desc: 'New Weapon / High Dmg' },
        { id: 'VOID_AXE', title: 'Void Axe', desc: 'New Weapon / Penetrating' },
        { id: 'FORCE_FIELD', title: 'Force Field', desc: 'New Weapon / Area' },
        { id: 'HEAL', title: 'System Repair', desc: 'Heal 50 HP' },
        { id: 'MULTISHOT', title: 'Multishot', desc: '+1 Projectile to All' },
        { id: 'ATK_SPEED', title: 'Overclock', desc: '+20% Fire Rate' },
        { id: 'DMG_UP', title: 'Power Surge', desc: '+20% Global Damage' },
        { id: 'SPEED_UP', title: 'Dash Module', desc: '+10% Move Speed' }
    ];
    activeUpgradeChoices = [];
    while(activeUpgradeChoices.length < 3) {
        const pick = possibleUpgrades[Math.floor(Math.random() * possibleUpgrades.length)];
        if (!activeUpgradeChoices.includes(pick)) activeUpgradeChoices.push(pick);
    }
}

function selectUpgrade(id) {
    if (id === 'HEAL') player.hp = Math.min(player.maxHp, player.hp + 50);
    else if (id === 'MULTISHOT') player.weapons.forEach(w => w.projectiles = (w.projectiles || 1) + 1);
    else if (id === 'ATK_SPEED') player.fireRateMult *= 0.8;
    else if (id === 'DMG_UP') player.damageMult *= 1.2;
    else if (id === 'SPEED_UP') player.speed *= 1.1;
    else {
        const existing = player.weapons.find(w => w.type === id);
        if (existing) {
            existing.level++;
            existing.damage = Math.floor(existing.damage * 1.2);
            if (existing.fireRate > 0.1 && id !== 'DATA_ORBIT') existing.fireRate *= 0.9;
        } else {
            player.addWeapon(id);
        }
    }
    sceneManager.changeScene('PLAYING');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0; gameTime = 0; spawnTimer = 0; waveTimer = 0;
    bossSpawned = false; nemesisSpawned = false;

    player.reset(selectedCharacter);
    enemyPool.reset(); projectilePool.reset(); gemPool.reset(); particlePool.reset(); damageTextPool.reset();

    sceneManager.changeScene('PLAYING');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    gameTime += dt; spawnTimer += dt; waveTimer += dt;
    const diffMult = 1.0 + (corruptionLevel * 0.1);
    const spawnRate = Math.max(0.2, (1.5 - (gameTime / 60) * 0.1) / diffMult);

    if (!bossSpawned && gameTime > 120) {
        bossSpawned = true;
        spawnDamageText("WARNING: WARDEN DETECTED", player.x, player.y - 100);
        sceneManager.addShake(30);
        const a = Math.random() * Math.PI * 2;
        enemyPool.get().init('WARDEN', player.x + Math.cos(a)*400, player.y + Math.sin(a)*400);
    }

    if (spawnTimer > spawnRate && !bossSpawned) {
        spawnTimer = 0;
        const a = Math.random() * Math.PI * 2;
        // Spawn far away to accommodate larger world/camera
        const r = Math.sqrt(canvas.width**2 + canvas.height**2)/2 + 150;
        const sx = player.x + Math.cos(a)*r, sy = player.y + Math.sin(a)*r;
        const rand = Math.random();
        let type = 'SWARMER';
        if (rand > 0.95) {
            for(let i=0; i<3; i++) {
                const off = (i/3)*Math.PI*2;
                const m = enemyPool.get();
                m.init('GLITCH_MITE', sx+Math.cos(off)*30, sy+Math.sin(off)*30);
                m.hp *= diffMult;
            }
            type = null;
        } else if (rand > 0.85) type = 'TANK';

        if (type) {
            const e = enemyPool.get();
            e.init(type, sx, sy);
            e.hp *= diffMult; e.speed *= diffMult;
        }
    }

    // Nemesis
    if (!nemesisSpawned && gameTime > 10 && GameData.progress.nemesis) {
        nemesisSpawned = true;
        const a = Math.random() * 6.28; const r = 300;
        const nem = enemyPool.get();
        nem.init(GameData.progress.nemesis.type, player.x + Math.cos(a)*r, player.y + Math.sin(a)*r);
        nem.isNemesis = true; nem.hp = GameData.progress.nemesis.hp * 2; nem.color = '#ff0';
        nem.width *= 1.5; nem.height *= 1.5;
    }

    // Wave
    if (waveTimer > 60 && !bossSpawned) {
        waveTimer = 0;
        const ab = Math.random()*6.28;
        for(let i=0;i<20;i++) {
            const a = ab + i*0.1;
            const r = Math.sqrt(canvas.width**2+canvas.height**2)/2+150;
            enemyPool.get().init('SWARMER', player.x+Math.cos(a)*r, player.y+Math.sin(a)*r);
        }
    }

    // Enemy Respawn / Despawn Logic
    // "5 tiles away" -> Tile is 64px. 5 tiles is 320px.
    // "Outside screen" -> Screen diagonal/2 + 320.
    const spawnRadius = Math.sqrt(canvas.width**2 + canvas.height**2)/2 + 320;

    enemyPool.active.forEach(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > spawnRadius) {
            // Respawn closer (just outside view)
            // "Intelligent" -> In front of player movement? Or random circle?
            // Random circle at edge of screen is standard for survival games.
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(canvas.width**2 + canvas.height**2)/2 + 50;
            e.x = player.x + Math.cos(angle) * r;
            e.y = player.y + Math.sin(angle) * r;
        }
    });

    player.update(dt, input, canvas.width, canvas.height);
    enemyPool.active.forEach(e => e.update(dt));
    projectilePool.active.forEach(p => p.update(dt));
    gemPool.active.forEach(g => {
        const d = Math.sqrt((player.x-g.x)**2+(player.y-g.y)**2);
        if (d < 100) { g.x+=(player.x-g.x)/d*300*dt; g.y+=(player.y-g.y)/d*300*dt; }
    });
    particlePool.active.forEach(p => p.update(dt));
    damageTextPool.active.forEach(t => t.update(dt));

    // Collision
    if (player.iframeTimer <= 0) {
        for (const e of enemyPool.active) {
            if (e.x < player.x+player.width && e.x+e.width > player.x && e.y < player.y+player.height && e.y+e.height > player.y) {
                player.takeDamage(10); sceneManager.addShake(10); break;
            }
        }
    }

    for (const p of projectilePool.active) {
        if (p.isEnemy) {
            if (p.x < player.x+player.width && p.x+p.width > player.x && p.y < player.y+player.height && p.y+p.height > player.y) {
                player.takeDamage(p.damage); sceneManager.addShake(5); projectilePool.release(p);
            }
        } else {
            for (const e of enemyPool.active) {
                if (p.x < e.x+e.width && p.x+p.width > e.x && p.y < e.y+e.height && p.y+p.height > e.y) {
                    // Calculate crit chance (e.g. 10%)
                    const isCrit = Math.random() < 0.1;
                    const dmg = isCrit ? p.damage * 2 : p.damage;

                    if (p.type === 'NEON_WAND') {
                        e.takeDamage(dmg, 100, p.x, p.y, isCrit);
                        projectilePool.release(p);
                        break;
                    }
                    else if (p.type === 'GLITCH_BOMB') {
                        createExplosion(p.x, p.y, p.damage); // Explosion handles its own damage logic
                        projectilePool.release(p);
                        break;
                    }
                    else if (p.type === 'PIXEL_RAIL') {
                        e.takeDamage(dmg, 50, p.x, p.y, isCrit);
                        // Do not release, it penetrates
                    }
                    else if (p.type === 'VOID_AXE') {
                        e.takeDamage(dmg, 200, p.x, p.y, isCrit);
                        // Penetrates
                    }
                    else if (p.type === 'FORCE_FIELD') {
                         e.takeDamage(dmg, 300, p.x, p.y, isCrit);
                    }
                }
            }
        }
    }

    for (const g of gemPool.active) {
        if (g.x < player.x+player.width && g.x+g.width > player.x && g.y < player.y+player.height && g.y+g.height > player.y) {
            if (g.isData) { GameData.progress.currency+=g.value; spawnDamageText("+$"+g.value, player.x, player.y-20); audioController.playPing(); }
            else player.gainXp(g.value);
            gemPool.release(g);
        }
    }
}

function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera Calculation
    let cx = canvas.width/2 - player.x - player.width/2;
    let cy = canvas.height/2 - player.y - player.height/2;
    // Clamp camera to world bounds if we want, or just let it float.
    // The requirement says "Plein Écran", and adapting.
    // But we have WORLD_WIDTH = 4000.
    // Let's clamp so we don't see infinite void, but the "void" is just blackness.
    // Clamping:
    cx = Math.min(0, Math.max(cx, canvas.width - WORLD_WIDTH));
    cy = Math.min(0, Math.max(cy, canvas.height - WORLD_HEIGHT));

    if (shakeIntensity > 0) {
        const dx = (Math.random()-0.5)*shakeIntensity*2;
        const dy = (Math.random()-0.5)*shakeIntensity*2;
        ctx.translate(dx, dy);
        shakeIntensity *= 0.9;
    }

    if (player.overdriveActive || player.iframeTimer > 0.3) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle='rgba(255,0,0,0.5)';
        ctx.translate((Math.random()-0.5)*10, 0);
    }

    ctx.save();
    // Use Math.floor to fix sub-pixel jitter
    ctx.translate(Math.floor(cx), Math.floor(cy));

    // Render World Background
    world.render(ctx, cx, cy, canvas.width, canvas.height);

    // Update Static Objects for collision (based on visible chunks)
    // Note: This updates the global staticObjects array in entities.js via the World class?
    // The World class returns objects, we need to update the entities.js export or handle collision differently.
    // Current architecture imports 'staticObjects' from entities.js.
    // We should update that array.

    // Actually, updateStaticObjects should probably be called in updateGame, not render.
    // But since the world is infinite, we need to know camera position.
    // Camera is calculated here.
    // Let's pass the static objects to collision logic or update the global array.
    // Since 'staticObjects' is an exported const array, we can clear and push.

    const visibleObjects = world.updateStaticObjects(cx, cy, canvas.width, canvas.height);
    // Sync with entities.js staticObjects
    // Note: staticObjects is imported as const, but it is an array so we can modify it.
    staticObjects.length = 0;
    visibleObjects.forEach(o => staticObjects.push(new StaticObject(o.type, o.x, o.y)));

    // Entities
    const all = [
        { y: player.y + player.height, d: () => {
            let spriteKey = 'PLAYER_STAND';
            if (player.isMoving) {
                // Animation Cycle: WALK1 -> STAND -> WALK1 -> STAND (User requested removal of WALK2)
                spriteKey = player.frameIndex === 0 ? 'PLAYER_WALK1' : 'PLAYER_STAND';
            }
            const img = world.images[spriteKey];

            if (img) {
                ctx.save();
                const cx = Math.floor(player.x + player.width / 2);
                const cy = Math.floor(player.y + player.height / 2);

                ctx.translate(cx, cy);
                if (!player.facingRight) ctx.scale(-1, 1);

                const drawW = 48;
                const drawH = 48;

                if (player.iframeTimer > 0 && Math.floor(Date.now()/100)%2===0) {
                     ctx.globalCompositeOperation = 'lighter';
                     ctx.globalAlpha = 0.7;
                }

                ctx.drawImage(img, -drawW/2, -drawH/2 - 10, drawW, drawH);
                ctx.restore();
            } else {
                ctx.fillStyle = player.color;
                ctx.fillRect(player.x, player.y, player.width, player.height);
                ctx.fillStyle = '#0aa';
                ctx.fillRect(player.x+player.width, player.y+4, 4, player.height);
                ctx.fillRect(player.x+4, player.y+player.height, player.width, 4);
                if (player.iframeTimer > 0 && Math.floor(Date.now()/100)%2===0) { ctx.fillStyle='#fff'; ctx.fillRect(player.x, player.y, player.width, player.height); }
            }
        }},
        ...enemyPool.active.map(e => ({ y: e.y + e.height, d: () => {
            if (e.isNemesis) {
                ctx.fillStyle='#ff0'; ctx.beginPath();
                ctx.moveTo(e.x,e.y-10); ctx.lineTo(e.x+5,e.y-2); ctx.lineTo(e.x+10,e.y-10); ctx.lineTo(e.x+15,e.y-2); ctx.lineTo(e.x+20,e.y-10); ctx.lineTo(e.x+20,e.y); ctx.lineTo(e.x,e.y); ctx.fill();
            }
            ctx.fillStyle = e.flashTimer > 0 ? '#fff' : e.color;
            ctx.fillRect(e.x, e.y, e.width, e.height);
            if (e.flashTimer <= 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(e.x+e.width, e.y+4, 4, e.height);
                ctx.fillRect(e.x+4, e.y+e.height, e.width, 4);
            }
        }})),
        ...gemPool.active.map(g => ({ y: g.y + g.height, d: () => {
            ctx.fillStyle = '#ff0'; ctx.beginPath();
            ctx.moveTo(g.x+g.width/2, g.y); ctx.lineTo(g.x+g.width, g.y+g.height/2);
            ctx.lineTo(g.x+g.width/2, g.y+g.height); ctx.lineTo(g.x, g.y+g.height/2); ctx.fill();
        }})),
        ...staticObjects.map(o => ({ y: o.y + o.height, d: () => {
             if (o.x + o.width < -cx || o.x > -cx + canvas.width || o.y + o.height < -cy || o.y > -cy + canvas.height) return;
             let key = o.type;
             if (key === 'TREE') key = 'TREE_1';
             if (key === 'BUSH') key = (Math.floor(o.x)%2===0) ? 'BUSH_1' : 'BUSH_2';
             const img = world.images[key];
             if (img) ctx.drawImage(img, o.x, o.y, o.width, o.height);
        }}))
    ].sort((a,b) => a.y - b.y);
    all.forEach(x => x.d());

    projectilePool.active.forEach(p => {
        // OPTIMIZATION: Removed ShadowBlur
        ctx.fillStyle='#fff';
        if(p.type==='NEON_WAND') ctx.fillRect(p.x,p.y,p.width,p.height);
        else if(p.type==='GLITCH_BOMB') { ctx.fillStyle='#f0f'; ctx.beginPath(); ctx.arc(p.x+p.width/2,p.y+p.height/2,p.width/2,0,6.28); ctx.fill(); }
        else if(p.type==='PIXEL_RAIL') { ctx.fillStyle='#0ff'; ctx.fillRect(p.x, p.y, p.width, p.height); }
        else if(p.type==='VOID_AXE') { ctx.fillStyle='#a0a'; ctx.fillRect(p.x, p.y, p.width, p.height); }
    });
    particlePool.active.forEach(p => { ctx.fillStyle=p.color; ctx.globalAlpha=p.life*2; ctx.fillRect(p.x, p.y, 4, 4); ctx.globalAlpha=1; });
    damageTextPool.active.forEach(t => {
        ctx.globalAlpha=Math.min(1, t.life*2);
        ctx.fillStyle = t.color || '#fff';
        ctx.font = `${t.fontSize || 30}px VT323`;
        ctx.strokeStyle='#000'; ctx.lineWidth=2;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha=1;
    });

    ctx.restore();

    if (player.overdriveActive || player.iframeTimer > 0.3) ctx.globalCompositeOperation = 'source-over';

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '24px VT323';
    ctx.fillText(`SCORE: ${score}`, 20, 40);
    ctx.fillText(`TIME: ${Math.floor(gameTime/60)}:${(Math.floor(gameTime%60)+"").padStart(2,'0')}`, 20, 70);
    ctx.fillText(`LVL: ${player.level}`, 20, 100);

    // Boss HP
    if (bossSpawned) {
        const warden = enemyPool.active.find(e => e.type === 'WARDEN');
        if (warden) {
            const bbw = canvas.width * 0.6;
            const bbx = (canvas.width - bbw) / 2;
            const bby = 80;
            ctx.fillStyle = '#333'; ctx.fillRect(bbx, bby, bbw, 30);
            ctx.fillStyle = '#f0f'; ctx.fillRect(bbx, bby, bbw * (Math.max(0, warden.hp) / warden.maxHp), 30);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bbx, bby, bbw, 30);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '24px VT323';
            ctx.fillText("THE WARDEN", canvas.width / 2, bby + 22);
        }
    }

    // HP
    const bw = 200, bx = (canvas.width-bw)/2, by = canvas.height-40;
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, 20);
    ctx.fillStyle = '#0f0'; ctx.fillRect(bx, by, bw*(Math.max(0,player.hp)/player.maxHp), 20);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(bx, by, bw, 20);

    // XP
    ctx.fillStyle='#333'; ctx.fillRect(0,0,canvas.width,5);
    ctx.fillStyle='#ff0'; ctx.fillRect(0,0,canvas.width*(player.xp/player.nextLevelXp),5);

    // Joystick
    if (input.joystick.active) {
        let size = 50; if (GameData.settings.joystickSize === 'Small') size=30; if (GameData.settings.joystickSize === 'Large') size=70;
        ctx.strokeStyle = 'rgba(0,255,255,0.3)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(input.joystick.originX, input.joystick.originY, size, 0, 6.28); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
        const kx = input.joystick.originX + input.joystick.x*size;
        const ky = input.joystick.originY + input.joystick.y*size;
        ctx.fillStyle='rgba(0,255,255,0.8)'; ctx.beginPath(); ctx.arc(kx, ky, 25, 0, 6.28); ctx.fill();
    }

    // OPTIMIZATION: Simplified CRT Effect (Vignette only) to avoid heavy fillRect loop
    if (GameData.settings.crtEffect) {
        // Just the vignette for now, scanlines are too heavy for high-res mobile
        const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height/3, canvas.width/2, canvas.height/2, canvas.height);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.4)");
        ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    if (currentScene === 'PLAYING') {
        if (player.glitchMeter >= player.glitchMax) UI.drawButton(ctx, 'OVERDRIVE!', canvas.width-150, canvas.height-100, 130, 80, '#f0f', () => player.activateOverdrive());
        else {
            const p = player.glitchMeter/player.glitchMax;
            ctx.fillStyle='#333'; ctx.fillRect(canvas.width-150, canvas.height-40, 130, 20);
            ctx.fillStyle='#f0f'; ctx.fillRect(canvas.width-150, canvas.height-40, 130*p, 20);
            ctx.strokeStyle='#fff'; ctx.strokeRect(canvas.width-150, canvas.height-40, 130, 20);
        }
        UI.drawButton(ctx, '||', canvas.width-60, 20, 40, 40, '#333', ()=>sceneManager.changeScene('PAUSED'));
    }

    UI.handleInput(input);
}

function gameLoop(ts) {
    const dt = Math.min((ts - lastTime)/1000, 0.1); lastTime = ts;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentScene === 'BOOT') {
        sceneManager.bootTimer += dt;

        if (!world.loaded && !world.loading) {
            world.loading = true;
            world.load().then(() => {
                staticObjects.length = 0;
                world.entities.forEach(e => {
                    staticObjects.push(new StaticObject(e.type, e.x, e.y));
                });
            });
        }

        ctx.fillStyle = '#0ff'; ctx.font = '30px VT323'; ctx.textAlign = 'center'; ctx.fillText('LOADING LOOMIVERS...', canvas.width/2, canvas.height/2);
        ctx.fillStyle='#333'; ctx.fillRect(canvas.width/2-100, canvas.height/2+20, 200, 10);
        ctx.fillStyle='#0f0'; ctx.fillRect(canvas.width/2-100, canvas.height/2+20, 200*Math.min(1, sceneManager.bootTimer/2), 10);

        if (sceneManager.bootTimer > 2 && world.loaded) sceneManager.changeScene('TITLE');
    } else if (currentScene === 'TITLE') {
        drawGridBackground(ts * 0.05);
        ctx.fillStyle = '#0ff'; ctx.font = '80px VT323'; ctx.textAlign = 'center'; ctx.fillText('LOOMIVERS', canvas.width/2, 100);
        ctx.fillStyle = '#fff'; ctx.font = '30px VT323'; ctx.fillText("THE WEAVER'S GLITCH", canvas.width/2, 140);
        UI.drawButton(ctx, 'PLAY', canvas.width/2-100, 220, 200, 50, '#0a0', () => sceneManager.changeScene('HUB'));
        UI.drawButton(ctx, 'SETTINGS', canvas.width/2-100, 290, 200, 50, '#333', () => sceneManager.changeScene('SETTINGS'));
        UI.drawButton(ctx, 'CREDITS', canvas.width/2-100, 360, 200, 50, '#333', () => alert("Created by Montano Mickael, Founder of Logoloom"));
        UI.drawButton(ctx, 'QUIT', canvas.width/2-100, 430, 200, 50, '#500', () => window.close());
        UI.handleInput(input);
    } else if (currentScene === 'HUB') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#0ff'; ctx.textAlign='center'; ctx.fillText("THE SANCTUARY", canvas.width/2, 50);
        ctx.fillStyle='#ff0'; ctx.textAlign='left'; ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, 20, 40);
        UI.drawButton(ctx, 'ENTER THE GLITCH', canvas.width/2-100, 120, 200, 50, '#f0f', () => { if(GameData.progress.storySeen) startGame(); else sceneManager.changeScene('STORY'); storyY=canvas.height; });
        UI.drawButton(ctx, 'CHARACTER SELECT', canvas.width/2-100, 190, 200, 50, '#333', () => sceneManager.changeScene('WARDROBE'));
        UI.drawButton(ctx, 'UPGRADE SHOP', canvas.width/2-100, 260, 200, 50, '#333', () => sceneManager.changeScene('SHOP'));
        UI.drawButton(ctx, 'ARCHIVES', canvas.width/2-100, 330, 200, 50, '#333', () => sceneManager.changeScene('ARCHIVES'));
        UI.drawButton(ctx, 'TROPHIES', canvas.width/2-100, 400, 200, 50, '#333', () => sceneManager.changeScene('TROPHIES'));
        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', () => sceneManager.changeScene('TITLE'));
        UI.handleInput(input);
    } else if (currentScene === 'ARCHIVES') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('ARCHIVES', canvas.width/2, 50);
        let y=100;
        const types = Object.keys(GameData.progress.bestiary);
        if(types.length===0) { ctx.font='20px VT323'; ctx.fillText("NO DATA COLLECTED", canvas.width/2, 200); }
        else {
            ctx.font='24px VT323';
            types.forEach(t => {
                ctx.textAlign='left';
                ctx.fillText(`${t}: ${GameData.progress.bestiary[t]} KILLS`, canvas.width/2-100, y);
                y+=40;
            });
        }
        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'TROPHIES') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('TROPHIES', canvas.width/2, 50);

        ctx.textAlign='left'; let y=120;
        ctx.fillText(`HIGH SCORE: ${GameData.progress.highScore}`, canvas.width/2-150, y); y+=50;

        const kills = GameData.progress.bestiary ? Object.values(GameData.progress.bestiary).reduce((a,b)=>a+b,0) : 0;
        ctx.fillText(`TOTAL KILLS: ${kills}`, canvas.width/2-150, y); y+=50;
        ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, canvas.width/2-150, y); y+=50;

        const achs = [
            {name: "First Blood", done: kills > 0},
            {name: "Survivor", done: GameData.progress.highScore > 1000},
            {name: "Glitch Hunter", done: GameData.progress.nemesis === null && GameData.progress.storySeen},
            {name: "Rich", done: GameData.progress.currency > 1000}
        ];
        achs.forEach(a => {
            ctx.fillStyle = a.done ? '#0f0' : '#555';
            ctx.fillText(`[${a.done?'X':' '}] ${a.name}`, canvas.width/2-150, y);
            y+=40;
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'WARDROBE') {
        ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("CHARACTER SELECT", canvas.width/2, 50);

        // Single column list, centered, easier for mobile
        const keys = Object.keys(CHARACTERS);
        const itemH = 80;
        const totalH = keys.length * itemH;
        let startY = 100;

        // Simple pagination logic if needed, but for 10 items (800px) might need scrolling.
        // Assuming user can scroll or we fit them?
        // Let's implement simple pagination.
        if (!window.wardrobePage) window.wardrobePage = 0;
        const itemsPerPage = 5;
        const totalPages = Math.ceil(keys.length / itemsPerPage);

        const startIdx = window.wardrobePage * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, keys.length);

        for(let i=startIdx; i<endIdx; i++) {
            const k = keys[i];
            const c = CHARACTERS[k];
            const u = GameData.progress.unlockedChars.includes(k);
            const s = selectedCharacter === k;

            const by = startY + ((i - startIdx) * 90);
            const bx = canvas.width/2 - 200;

            // Background for item
            ctx.fillStyle = s ? '#224422' : '#222';
            ctx.fillRect(bx, by, 400, 80);
            ctx.strokeStyle = s ? '#0f0' : '#555';
            ctx.strokeRect(bx, by, 400, 80);

            // Sprite Preview
            const img = world.images['PLAYER_STAND'];
            if (img) {
                // Tinting logic is hard with raw canvas without extensive caching or composite ops.
                // Just draw the base sprite + a colored rect indicator for now to keep it simple/performant.
                ctx.drawImage(img, bx + 10, by + 10, 60, 60);
                // Color indicator
                ctx.fillStyle = c.color;
                ctx.fillRect(bx + 55, by + 55, 15, 15);
                ctx.strokeStyle = '#fff'; ctx.strokeRect(bx + 55, by + 55, 15, 15);
            } else {
                ctx.fillStyle = c.color;
                ctx.fillRect(bx + 10, by + 10, 60, 60);
            }

            ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='24px VT323';
            ctx.fillText(c.name, bx + 80, by + 30);
            ctx.font='16px VT323'; ctx.fillStyle='#aaa';
            ctx.fillText(c.desc, bx + 80, by + 55);

            const btnX = bx + 280;
            const btnY = by + 15;

            if(u){
                if(!s) UI.drawButton(ctx, 'SELECT', btnX, btnY, 100, 50, '#00a', ()=>selectedCharacter=k);
                else { ctx.fillStyle='#0f0'; ctx.fillText("EQUIPPED", btnX + 50, btnY + 25); }
            } else if(GameData.progress.currency>=c.price) {
                UI.drawButton(ctx, `$${c.price}`, btnX, btnY, 100, 50, '#0a0', ()=>{GameData.progress.currency-=c.price; GameData.progress.unlockedChars.push(k); GameData.saveProgress();});
            } else {
                ctx.fillStyle='#555'; ctx.textAlign='center'; ctx.fillText(`LOCKED`, btnX + 50, btnY + 15);
                ctx.fillText(`$${c.price}`, btnX + 50, btnY + 35);
            }
        }

        // Pagination Controls
        if (totalPages > 1) {
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '20px VT323';
            ctx.fillText(`PAGE ${window.wardrobePage + 1}/${totalPages}`, canvas.width/2, startY + (itemsPerPage * 90) + 20);
            if (window.wardrobePage > 0) UI.drawButton(ctx, '<', canvas.width/2 - 100, startY + (itemsPerPage * 90), 50, 40, '#333', () => window.wardrobePage--);
            if (window.wardrobePage < totalPages - 1) UI.drawButton(ctx, '>', canvas.width/2 + 50, startY + (itemsPerPage * 90), 50, 40, '#333', () => window.wardrobePage++);
        }

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'PLAYING') {
        updateGame(dt); render();
    } else if (currentScene === 'LEVEL_UP') {
        render(); ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.fillStyle='#fff'; ctx.font='40px VT323'; ctx.textAlign='center';
        ctx.fillText("LEVEL UP!", canvas.width/2, 80);

        // Responsive Cards Layout
        const marginPercent = 0.15; // 15% margin
        const usableWidth = canvas.width * (1 - 2*marginPercent);
        const startX = canvas.width * marginPercent;
        const cardGap = 20;

        // Decide orientation based on aspect ratio
        const isPortrait = canvas.height > canvas.width;

        if (isPortrait) {
            // Vertical Layout
            const cardHeight = (canvas.height - 200) / 3 - cardGap;
            const cardWidth = usableWidth;
            let y = 150;

            activeUpgradeChoices.forEach(c => {
                drawUpgradeCard(ctx, c, startX, y, cardWidth, cardHeight, () => selectUpgrade(c.id));
                y += cardHeight + cardGap;
            });
        } else {
            // Horizontal Layout
            const cardWidth = (usableWidth - 2*cardGap) / 3;
            const cardHeight = canvas.height - 250;
            let x = startX;
            let y = 150;

            activeUpgradeChoices.forEach(c => {
                drawUpgradeCard(ctx, c, x, y, cardWidth, cardHeight, () => selectUpgrade(c.id));
                x += cardWidth + cardGap;
            });
        }
        UI.handleInput(input);
    } else if (currentScene === 'PAUSED') {
        render();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#fff'; ctx.font = '60px VT323'; ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width/2, 80);

        // Show Stats
        ctx.font = '24px VT323'; ctx.textAlign = 'left';
        let y = 140;
        ctx.fillText("--- WEAPONS ---", canvas.width/2 - 200, y);
        y+=30;
        player.weapons.forEach(w => {
            // Friendly Name Logic could be extracted
            const name = w.type.replace('_', ' ');
            ctx.fillText(`${name} Lv.${w.level} (Dmg: ${Math.floor(w.damage * player.damageMult)})`, canvas.width/2 - 200, y);
            y+=25;
        });

        y += 20;
        ctx.fillText("--- STATS ---", canvas.width/2 - 200, y);
        y+=30;
        ctx.fillText(`HP: ${Math.floor(player.hp)}/${player.maxHp}`, canvas.width/2 - 200, y); y+=25;
        ctx.fillText(`LVL: ${player.level} (XP: ${player.xp}/${player.nextLevelXp})`, canvas.width/2 - 200, y); y+=25;
        ctx.fillText(`DMG MULT: x${player.damageMult.toFixed(2)}`, canvas.width/2 - 200, y); y+=25;
        ctx.fillText(`FIRE RATE: x${(1/player.fireRateMult).toFixed(2)}`, canvas.width/2 - 200, y); y+=25;
        ctx.fillText(`SPEED: ${Math.floor(player.speed)}`, canvas.width/2 - 200, y); y+=25;

        UI.drawButton(ctx, 'RESUME', canvas.width/2+50, canvas.height-150, 150, 50, '#0a0', () => sceneManager.changeScene('PLAYING'));
        UI.drawButton(ctx, 'QUIT', canvas.width/2+50, canvas.height-80, 150, 50, '#a00', () => sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'GAME_OVER') {
        render(); ctx.fillStyle='rgba(50,0,0,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign='center'; ctx.fillStyle='#f00'; ctx.fillText("CRITICAL FAILURE", canvas.width/2, canvas.height/3);
        UI.drawButton(ctx, 'RETRY', canvas.width/2-100, canvas.height/2+60, 200, 60, '#fff', ()=>startGame());
        UI.drawButton(ctx, 'RETURN', canvas.width/2-100, canvas.height/2+140, 200, 60, '#333', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'STORY') {
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        storyY-=50*dt; let y=storyY;
        const txt=["THE LOOM...", "IS UNRAVELING.", "", "YOU ARE THE LAST.", "SURVIVE."];
        ctx.fillStyle='#0ff'; ctx.textAlign='center';
        txt.forEach(l=>{ctx.fillText(l, canvas.width/2, y); y+=50;});
        if(y<0 || input.taps.length>0) { GameData.progress.storySeen=true; GameData.saveProgress(); startGame(); }
    } else if (currentScene === 'SHOP') {
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('UPGRADE SHOP', canvas.width/2, 50);

        let y = 100;
        const upgrades = [
            { id: 'health', name: 'MAX HP', cost: 100 },
            { id: 'damage', name: 'DAMAGE', cost: 150 },
            { id: 'magnet', name: 'MAGNET', cost: 100 }
        ];

        upgrades.forEach(u => {
             const lvl = GameData.progress.upgrades[u.id] || 0;
             const cost = u.cost * (lvl + 1);
             ctx.fillStyle='#fff'; ctx.textAlign='left';
             ctx.fillText(`${u.name} (Lvl ${lvl})`, canvas.width/2-150, y+30);

             if (GameData.progress.currency >= cost) {
                 UI.drawButton(ctx, `UPGRADE ($${cost})`, canvas.width/2+50, y, 150, 40, '#0a0', () => {
                     GameData.progress.currency -= cost;
                     GameData.progress.upgrades[u.id]++;
                     GameData.saveProgress();
                 });
             } else {
                 ctx.fillStyle='#555'; ctx.fillRect(canvas.width/2+50, y, 150, 40);
                 ctx.fillStyle='#888'; ctx.fillText(`$${cost}`, canvas.width/2+90, y+25);
             }
             y += 60;
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'SETTINGS') {
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('SETTINGS', canvas.width/2, 50);

        let y = 100;

        UI.drawSlider(ctx, 'MASTER VOLUME', GameData.settings.masterVolume, canvas.width/2 - 150, y, 300, 30, (val) => {
            GameData.settings.masterVolume = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawToggle(ctx, 'CRT EFFECT', GameData.settings.crtEffect, canvas.width/2 - 150, y, 300, 40, (val) => {
            GameData.settings.crtEffect = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawSelector(ctx, 'PARTICLES', ['Low', 'Medium', 'High'], GameData.settings.particles, canvas.width/2 - 150, y, 300, 40, (val) => {
            GameData.settings.particles = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawSelector(ctx, 'JOYSTICK SIDE', ['Left', 'Right'], GameData.settings.joystickSide, canvas.width/2 - 150, y, 300, 40, (val) => {
            GameData.settings.joystickSide = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawSelector(ctx, 'JOYSTICK SIZE', ['Small', 'Medium', 'Large'], GameData.settings.joystickSize, canvas.width/2 - 150, y, 300, 40, (val) => {
            GameData.settings.joystickSize = val;
            GameData.saveSettings();
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('TITLE'));
        UI.handleInput(input);
    }

    input.clearTaps();
    requestAnimationFrame(gameLoop);
}

function drawGridBackground(offset) {
    ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.beginPath();
    const gs = 50; const sy = (offset*20)%gs;
    for(let x=0;x<canvas.width;x+=gs){ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);}
    for(let y=sy;y<canvas.height;y+=gs){ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);}
    ctx.stroke();
}

GameData.load();
const resumeAudio = () => { if(audioController.audioCtx && audioController.audioCtx.state === 'suspended') audioController.audioCtx.resume(); audioController.init(); };
window.addEventListener('touchstart', resumeAudio, {once:true});
window.addEventListener('click', resumeAudio, {once:true});

lastTime = performance.now();
requestAnimationFrame(gameLoop);

// --- ANDROID LIFECYCLE HOOKS ---
window.pauseGame = function() {
    if (typeof sceneManager !== 'undefined' && currentScene === 'PLAYING') {
        sceneManager.changeScene('PAUSED');
    }
    if (typeof audioController !== 'undefined' && audioController.audioCtx) {
        audioController.audioCtx.suspend();
    }
    console.log("Game Paused via Android Lifecycle");
};

window.resumeGame = function() {
    if (typeof audioController !== 'undefined' && audioController.audioCtx) {
        audioController.audioCtx.resume();
    }
    console.log("Game Resumed via Android Lifecycle");
};

function drawUpgradeCard(ctx, upgrade, x, y, w, h, action) {
    // Card Background
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);

    // Pixel Art Border (Double Border)
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#555';
    ctx.strokeRect(x+6, y+6, w-12, h-12);

    // Placeholder Icon
    const iconSize = Math.min(w * 0.3, h * 0.3);
    const iconX = x + (w - iconSize) / 2;
    const iconY = y + 20;
    ctx.fillStyle = '#444';
    ctx.fillRect(iconX, iconY, iconSize, iconSize);
    ctx.strokeStyle = '#0ff';
    ctx.strokeRect(iconX, iconY, iconSize, iconSize);
    ctx.fillStyle = '#0ff'; ctx.font = '40px VT323'; ctx.textAlign='center';
    ctx.fillText("?", iconX + iconSize/2, iconY + iconSize/2 + 10);

    // Title
    const isStat = ['HEAL','MULTISHOT','ATK_SPEED','DMG_UP','SPEED_UP'].includes(upgrade.id);
    const hasWep = player.weapons.some(w => w.type === upgrade.id);
    const prefix = (!isStat && !hasWep) ? "NEW! " : (hasWep ? "LVL UP! " : "");

    ctx.fillStyle = '#ff0'; ctx.font = '24px VT323'; ctx.textAlign = 'center';
    ctx.fillText(prefix + upgrade.title, x + w/2, iconY + iconSize + 30);

    // Description
    ctx.fillStyle = '#ccc'; ctx.font = '18px VT323';
    // Wrap text if needed? For now simple
    ctx.fillText(upgrade.desc, x + w/2, iconY + iconSize + 60);

    // Register Button
    UI.registerArea(x, y, w, h, action);
}
