import { GameData } from './utils.js';
import { UI } from './ui.js';
import { audioController } from './audio.js';
import { world } from './world.js';
import { player, enemyPool, projectilePool, gemPool, particlePool, damageTextPool, spawnGem, spawnParticle, spawnDamageText, staticObjects, StaticObject, Drone, portalPool, spawnPortal } from './entities.js';
import { CHARACTERS, WORLD_WIDTH, WORLD_HEIGHT, PASSIVES, CORRUPTED_ARTIFACTS, EVOLUTIONS, DRONE_EVOLUTIONS } from './constants.js';

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
let nextBossTime = 300; // First boss at 5 minutes
let nemesisSpawned = false;
let shakeIntensity = 0;
let storyY = 0;
let activeUpgradeChoices = [];
let selectedCharacter = 'WEAVER';
let comboCount = 0;
let comboTimer = 0;
let challengeTimer = 0;

// Input Handler
class InputHandler {
    constructor() {
        this.joystick = { x: 0, y: 0, active: false, originX: 0, originY: 0 };
        this.keys = {};
        this.taps = [];
        this.lastTouchTime = 0;
        this.pointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;
        this.setupTouch();
        this.setupKeyboard();
    }

    setupTouch() {
        document.addEventListener('touchstart', (e) => {
            this.lastTouchTime = Date.now();
            const touch = e.changedTouches[0];
            this.pointerDown = true;
            this.pointerX = touch.clientX;
            this.pointerY = touch.clientY;

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
            const touch = e.changedTouches[0];
            this.pointerX = touch.clientX;
            this.pointerY = touch.clientY;

            if (currentScene !== 'PLAYING' || !this.joystick.active) return;
            e.preventDefault();
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
            this.pointerDown = false;
        });

        document.addEventListener('mousedown', (e) => {
             // Debounce: Ignore mouse events if touch events were triggered recently (500ms)
             if (Date.now() - this.lastTouchTime < 500) return;
             this.taps.push({ x: e.clientX, y: e.clientY });
             this.pointerDown = true;
             this.pointerX = e.clientX;
             this.pointerY = e.clientY;
        });

        document.addEventListener('mouseup', () => {
            this.pointerDown = false;
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

        // Combo Logic
        comboCount++;
        comboTimer = 3.0;
        // XP Multiplier based on combo? Not implemented yet, just visual flair first.
        if (comboCount % 10 === 0) spawnDamageText(`COMBO x${comboCount}!`, player.x, player.y - 40, true);
    },
    onBossDeath() {
        bossSpawned = false;
        audioController.setBossMode(false);
        sceneManager.addScore(1000);
        spawnDamageText("BOSS DEFEATED!", player.x, player.y - 100);
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

    if (w.type === 'NEON_WAND' || w.type === 'HOLY_BEAM') {
        if (nearest && minDist < 400*400) {
            for(let i=0; i<count; i++) {
                const spread = (i - (count-1)/2) * 20;
                const tx = nearest.x + nearest.width/2 + spread;
                const ty = nearest.y + nearest.height/2 + spread;
                projectilePool.get().init(w.type, pCx, pCy, tx, ty, dmg);
            }
            w.cooldown = w.fireRate * p.fireRateMult;
        }
    } else if (w.type === 'GLITCH_BOMB' || w.type === 'CLUSTER_BOMB') {
        for(let i=0; i<count; i++) {
            let tx, ty;
            if (enemyPool.active.length > 0) {
                const r = enemyPool.active[Math.floor(Math.random() * enemyPool.active.length)];
                tx = r.x + r.width/2; ty = r.y + r.height/2;
            } else {
                const a = Math.random() * Math.PI * 2;
                tx = pCx + Math.cos(a)*200; ty = pCy + Math.sin(a)*200;
            }
            projectilePool.get().init(w.type, pCx, pCy, tx, ty, dmg);
        }
        w.cooldown = w.fireRate * p.fireRateMult;
    } else if (w.type === 'PIXEL_RAIL' || w.type === 'RAIL_TURRET') {
        if (nearest) {
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

    // Check Evolutions First (Priority)
    for (const w of player.weapons) {
        if (w.level >= 8 && !w.evolved && EVOLUTIONS[w.type]) {
            const evo = EVOLUTIONS[w.type];
            const hasPassive = player.passives.some(p => p.id === evo.passive);
            if (hasPassive) {
                // Guarantee Evolution
                activeUpgradeChoices = [{
                    id: evo.result,
                    title: `EVOLUTION: ${evo.name}`,
                    desc: 'Weapon Evolved!',
                    isEvolution: true,
                    baseId: w.type
                }];
                return;
            }
        }
    }

    const pool = [];

    // Weapons (New or Upgrade)
    const weaponTypes = ['NEON_WAND', 'DATA_ORBIT', 'GLITCH_BOMB', 'PIXEL_RAIL', 'VOID_AXE', 'FORCE_FIELD'];
    weaponTypes.forEach(t => {
        const existing = player.weapons.find(w => w.type === t);
        if (!existing) pool.push({ id: t, title: t.replace('_', ' '), desc: 'New Weapon' });
        else if (existing.level < 8) pool.push({ id: t, title: t.replace('_', ' '), desc: `Level Up (Lvl ${existing.level+1})` });
    });

    // Passives
    PASSIVES.forEach(p => {
        pool.push({ id: p.id, title: p.name, desc: p.desc, isPassive: true });
    });

    // Drone Evolution (if base drone exists and not yet evolved)
    if (player.drones.length > 0 && player.drones[0].type === 'BASE') {
        DRONE_EVOLUTIONS.forEach(e => {
            pool.push({ id: e.id, title: e.name, desc: e.desc, isDroneEvo: true });
        });
    }

    // Corrupted Artifacts (Small chance)
    if (Math.random() < 0.2) {
         CORRUPTED_ARTIFACTS.forEach(a => pool.push({ id: a.id, title: `CURSED: ${a.name}`, desc: a.desc, isPassive: true }));
    }

    // Heal (Always available fallback)
    pool.push({ id: 'HEAL', title: 'System Repair', desc: 'Heal 50 HP' });

    activeUpgradeChoices = [];
    while(activeUpgradeChoices.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        const pick = pool[idx];
        if (!activeUpgradeChoices.some(c => c.id === pick.id)) activeUpgradeChoices.push(pick);
    }
}

function selectUpgrade(id) {
    const choice = activeUpgradeChoices.find(c => c.id === id);

    if (choice && choice.isEvolution) {
        const baseW = player.weapons.find(w => w.type === choice.baseId);
        if (baseW) {
            baseW.type = id; // Transform weapon type
            baseW.evolved = true;
            baseW.damage *= 2; // Simple buff
            baseW.cooldown *= 0.5;
            sceneManager.addShake(50);
            spawnDamageText("EVOLUTION!", player.x, player.y - 50, true);
        }
    } else if (choice && choice.isDroneEvo) {
        player.drones.forEach(d => d.evolve(id));
        sceneManager.addShake(20);
        spawnDamageText("DRONE UPGRADE!", player.x, player.y - 50, true);
    } else if (choice && choice.isPassive) {
        if (id === 'DRONE_MODULE') player.addDrone();
        else player.addPassive(id);
    } else if (id === 'HEAL') {
        player.hp = Math.min(player.maxHp, player.hp + 50);
    } else {
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
    bossSpawned = false; nextBossTime = 300; nemesisSpawned = false;
    comboCount = 0; comboTimer = 0;

    player.reset(selectedCharacter);

    // Hardcore Mode
    if (GameData.settings.hardcore) {
        player.maxHp = 1;
        player.hp = 1;
    }

    enemyPool.reset(); projectilePool.reset(); gemPool.reset(); particlePool.reset(); damageTextPool.reset();

    sceneManager.changeScene('PLAYING');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    gameTime += dt; spawnTimer += dt; waveTimer += dt;
    if (comboCount > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) comboCount = 0;
    }
    const diffMult = 1.0 + (corruptionLevel * 0.1);
    const spawnRate = Math.max(0.2, (1.5 - (gameTime / 60) * 0.1) / diffMult);

    if (!bossSpawned && gameTime >= nextBossTime) {
        bossSpawned = true;
        nextBossTime += 300; // Next boss in 5 mins

        sceneManager.addShake(30);
        const a = Math.random() * Math.PI * 2;
        const x = player.x + Math.cos(a)*400;
        const y = player.y + Math.sin(a)*400;

        if (gameTime >= 1200) { // 20 mins: Map Boss
            spawnDamageText("WARNING: THE CORRUPTOR HAS ARRIVED", player.x, player.y - 100);
            const boss = enemyPool.get();
            boss.init('WARDEN', x, y);
            // Make map boss stronger
            boss.hp *= 5; boss.maxHp *= 5; boss.width *= 1.5; boss.height *= 1.5; boss.color = '#f00';
            // Custom behavior could be added in Enemy class, but stats suffice for now.
        } else {
            spawnDamageText("WARNING: WARDEN DETECTED", player.x, player.y - 100);
            const boss = enemyPool.get();
            boss.init('WARDEN', x, y);
            // Dynamic Difficulty Scaling for Boss
            // Health scales with game time to keep it challenging
            const scaleFactor = 1.0 + (gameTime / 300); // +100% HP every 5 mins
            boss.hp *= scaleFactor;
            boss.maxHp *= scaleFactor;
        }
        audioController.setBossMode(true);
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

        // Challenge Portal Spawn (Rare)
        if (Math.random() < 0.005 && portalPool.active.length === 0) { // 0.5% chance per spawn cycle
             // Spawn visible on screen but away from player? Or off screen?
             // Let's spawn it within view to entice player
             const pa = Math.random() * 6.28;
             const pr = 300;
             spawnPortal(player.x + Math.cos(pa)*pr, player.y + Math.sin(pa)*pr);
             spawnDamageText("PORTAL DETECTED", player.x, player.y - 80, true);
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
    // "Tight leash" -> Respawn enemies closer to keep the horde pressure constant.
    const screenDiag = Math.sqrt(canvas.width**2 + canvas.height**2);
    const spawnRadius = screenDiag/2 + 150; // Despawn if slightly further out

    enemyPool.active.forEach(e => {
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > spawnRadius) {
            // Respawn closer (just outside view)
            const angle = Math.random() * Math.PI * 2;
            const r = screenDiag/2 + 50; // Just outside screen
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
                    else if (p.type === 'HOLY_BEAM') {
                        e.takeDamage(dmg, 100, p.x, p.y, isCrit);
                        // Penetrates
                    }
                    else if (p.type === 'GLITCH_BOMB' || p.type === 'CLUSTER_BOMB') {
                        createExplosion(p.x, p.y, p.damage, p.type === 'CLUSTER_BOMB' ? 200 : 100);
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

    // Portal Interaction
    for (const p of portalPool.active) {
        if (p.x < player.x + player.width && p.x + p.width > player.x && p.y < player.y + player.height && p.y + p.height > player.y) {
            portalPool.release(p);
            challengeTimer = 30; // 30s challenge
            sceneManager.changeScene('CHALLENGE');
            sceneManager.addShake(20);
            audioController.setBossMode(true); // Dramatic music
        }
    }
}

function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Camera Calculation
    let cx = canvas.width/2 - player.x - player.width/2;
    let cy = canvas.height/2 - player.y - player.height/2;
    // Infinite World: No Clamping

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
        ...player.drones.map(d => ({ y: d.y + 24, d: () => {
             let key = d.type === 'BASE' ? 'DRONE_BASE' : d.type;
             let img = world.images[key];
             if (!img) img = world.images['UI_MISSING'];
             if (img) {
                 ctx.drawImage(img, Math.floor(d.x), Math.floor(d.y), 24, 24);
             }
        }})),
        { y: player.y + player.height, d: () => {
            let spriteKey = 'PLAYER_STAND';
            if (player.state === 'WALK') {
                spriteKey = `PLAYER_WALK${player.frameIndex}`;
            } else if (player.state === 'ATTACK') {
                spriteKey = `PLAYER_ATTACK${player.frameIndex}`;
            } else if (player.state === 'DEATH') {
                spriteKey = 'PLAYER_DEATH';
            }

            let img = world.images[spriteKey];
            if (!img) img = world.images['UI_MISSING'];

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
            }
        }},
        ...enemyPool.active.map(e => ({ y: e.y + e.height, d: () => {
            if (e.isNemesis) {
                ctx.fillStyle='#ff0'; ctx.beginPath();
                ctx.moveTo(e.x,e.y-10); ctx.lineTo(e.x+5,e.y-2); ctx.lineTo(e.x+10,e.y-10); ctx.lineTo(e.x+15,e.y-2); ctx.lineTo(e.x+20,e.y-10); ctx.lineTo(e.x+20,e.y); ctx.lineTo(e.x,e.y); ctx.fill();
            }

            let baseKey = e.type; // SWARMER, TANK, WARDEN
            // Map types to keys
            if (e.type === 'WARDEN') baseKey = 'WARDEN';
            else if (e.type === 'TANK') baseKey = 'TANK';
            else if (e.type === 'GLITCH_MITE') baseKey = 'GLITCH_MITE';
            else if (e.type === 'SWARMER') baseKey = 'SWARMER';

            let action = e.state === 'WALK' ? `WALK${e.frameIndex}` : 'STAND';
            let key = `${baseKey}_${action}`;

            let img = world.images[key];
            if (!img) {
                 key = `${baseKey}_STAND`;
                 img = world.images[key];
            }
            if (!img) img = world.images['UI_MISSING'];

            if (img) {
                ctx.save();
                const cx = Math.floor(e.x + e.width / 2);
                const cy = Math.floor(e.y + e.height / 2);
                ctx.translate(cx, cy);
                if (!e.facingRight) ctx.scale(-1, 1);

                const drawW = e.width * 1.5;
                const drawH = e.height * 1.5;

                if (e.flashTimer > 0) {
                     ctx.globalCompositeOperation = 'lighter';
                     ctx.globalAlpha = 0.8;
                }

                ctx.drawImage(img, -drawW/2, -drawH/2 - 5, drawW, drawH);
                ctx.restore();
            }
        }})),
        ...gemPool.active.map(g => ({ y: g.y + g.height, d: () => {
            // Gem rendering
            let key = g.isData ? 'ITEM_DATA' : 'ITEM_XP';
            let img = world.images[key] || world.images['UI_MISSING'];
            if (img) {
                ctx.drawImage(img, g.x, g.y, g.width, g.height);
            }
        }})),
        ...staticObjects.map(o => ({ y: o.y + o.height, d: () => {
             if (o.x + o.width < -cx || o.x > -cx + canvas.width || o.y + o.height < -cy || o.y > -cy + canvas.height) return;
             let key = o.type;
             if (key === 'TREE') key = 'DECOR_TREE1';
             if (key === 'BUSH') key = (Math.floor(o.x)%2===0) ? 'DECOR_BUSH1' : 'DECOR_BUSH2';
             let img = world.images[key];
             if (!img) img = world.images['UI_MISSING'];
             if (img) ctx.drawImage(img, o.x, o.y, o.width, o.height);
        }})),
        ...portalPool.active.map(p => ({ y: p.y + p.height, d: () => {
             let img = world.images['PORTAL_GATE'] || world.images['UI_MISSING'];
             if (img) {
                 ctx.save();
                 ctx.globalAlpha = 0.8 + Math.sin(Date.now() / 200) * 0.2;
                 ctx.drawImage(img, p.x, p.y, p.width, p.height);
                 ctx.restore();
             }
        }}))
    ].sort((a,b) => a.y - b.y);
    all.forEach(x => x.d());

    projectilePool.active.forEach(p => {
        let key = null;
        if (p.type === 'NEON_WAND') key = 'PROJ_NEON';
        else if (p.type === 'GLITCH_BOMB') key = 'PROJ_BOMB';
        else if (p.type === 'PIXEL_RAIL') key = 'PROJ_RAIL';
        else if (p.type === 'VOID_AXE') key = 'PROJ_AXE';
        else if (p.type === 'BOSS_ORB') key = 'PROJ_ORB';

        let img = world.images[key];
        if (!img) img = world.images['UI_MISSING'];
        if (img) {
            ctx.drawImage(img, p.x, p.y, p.width, p.height);
        }
    });
    particlePool.active.forEach(p => { ctx.fillStyle=p.color; ctx.globalAlpha=p.life*2; ctx.fillRect(p.x, p.y, 4, 4); ctx.globalAlpha=1; });
    damageTextPool.active.forEach(t => {
        ctx.globalAlpha=Math.min(1, t.life*2);
        ctx.fillStyle = t.color || '#fff';
        ctx.font = `${t.fontSize || 30}px monospace`;
        ctx.strokeStyle='#000'; ctx.lineWidth=2;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha=1;
    });

    ctx.restore();

    if (player.overdriveActive || player.iframeTimer > 0.3) ctx.globalCompositeOperation = 'source-over';

    // HUD Layout
    const hudPadding = 20;

    // Top Left: Stats
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '24px monospace';
    ctx.fillText(`SCORE: ${score}`, hudPadding, 40);
    ctx.fillText(`TIME:  ${Math.floor(gameTime/60)}:${(Math.floor(gameTime%60)+"").padStart(2,'0')}`, hudPadding, 70);
    ctx.fillText(`LVL:   ${player.level}`, hudPadding, 100);

    if (GameData.settings.hardcore) {
        ctx.fillStyle = '#f00'; ctx.fillText("HARDCORE", hudPadding, 130);
    }

    // Top Right: Combo
    if (comboCount > 5) {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = `${30 + Math.min(20, comboCount/2)}px monospace`;
        ctx.fillStyle = `hsl(${Date.now() % 360}, 100%, 70%)`;
        ctx.fillText(`${comboCount} HITS!`, canvas.width - hudPadding, 50);

        // Combo Timer Bar
        const cbW = 150;
        ctx.fillStyle = '#fff'; ctx.fillRect(canvas.width - cbW - hudPadding, 60, cbW, 5);
        ctx.fillStyle = '#ff0'; ctx.fillRect(canvas.width - cbW - hudPadding, 60, cbW * (Math.max(0, comboTimer)/3.0), 5);
        ctx.restore();
    }

    // Top Center: Boss HP (if active)
    if (bossSpawned) {
        const warden = enemyPool.active.find(e => e.type === 'WARDEN');
        if (warden) {
            const bbw = Math.min(400, canvas.width * 0.5);
            const bbx = (canvas.width - bbw) / 2;
            const bby = 60;
            ctx.fillStyle = '#333'; ctx.fillRect(bbx, bby, bbw, 20);
            ctx.fillStyle = '#f0f'; ctx.fillRect(bbx, bby, bbw * (Math.max(0, warden.hp) / warden.maxHp), 20);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bbx, bby, bbw, 20);
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '16px monospace';
            ctx.fillText("BOSS", canvas.width / 2, bby + 15);
        }
    }

    // Bottom Center: Player HP
    const bw = 300, bx = (canvas.width-bw)/2, by = canvas.height-30;
    // Background
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, 20);
    // Fill
    ctx.fillStyle = player.hp < player.maxHp * 0.3 ? '#f00' : '#0f0'; // Red if low
    ctx.fillRect(bx, by, bw*(Math.max(0,player.hp)/player.maxHp), 20);
    // Border
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, 20);
    // Text overlay
    ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font='14px monospace';
    ctx.fillText(`${Math.ceil(player.hp)} / ${Math.floor(player.maxHp)}`, canvas.width/2, by + 15);

    // Bottom Edge: XP Bar
    ctx.fillStyle='#333'; ctx.fillRect(0, canvas.height-5, canvas.width, 5);
    ctx.fillStyle='#0ff'; ctx.fillRect(0, canvas.height-5, canvas.width*(player.xp/player.nextLevelXp), 5);

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
        if (player.glitchMeter >= player.glitchMax) UI.drawButton(ctx, 'OVERDRIVE!', canvas.width-150, canvas.height-100, 130, 80, '#f0f', () => player.activateOverdrive(), 'primary');
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
                // Initial load complete
            });
        }

        drawGridBackground(ts * 0.05);
        ctx.fillStyle = '#0ff'; ctx.font = '30px monospace'; ctx.textAlign = 'center'; ctx.fillText('LOADING LOOMIVERS...', canvas.width/2, canvas.height/2);
        ctx.fillStyle='#333'; ctx.fillRect(canvas.width/2-100, canvas.height/2+20, 200, 10);
        ctx.fillStyle='#0f0'; ctx.fillRect(canvas.width/2-100, canvas.height/2+20, 200*Math.min(1, sceneManager.bootTimer/2), 10);

        if (sceneManager.bootTimer > 2 && world.loaded) sceneManager.changeScene('TITLE');
    } else if (currentScene === 'TITLE') {
        drawGridBackground(ts * 0.05);

        // Glitch Title
        ctx.textAlign = 'center';
        if (Math.random() > 0.95) ctx.translate((Math.random()-0.5)*10, 0);

        ctx.shadowColor = '#0ff'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 80px monospace';
        ctx.fillText('LOOMIVERS', canvas.width/2, 120);

        ctx.shadowBlur = 0; ctx.fillStyle = '#f0f';
        ctx.fillText('LOOMIVERS', canvas.width/2 - 2, 120);
        ctx.fillStyle = '#0ff';
        ctx.fillText('LOOMIVERS', canvas.width/2 + 2, 120);

        ctx.setTransform(1,0,0,1,0,0); // Reset glitch

        ctx.fillStyle = '#fff'; ctx.font = '24px monospace'; ctx.fillText("THE WEAVER'S GLITCH", canvas.width/2, 160);

        const btnW = 220; const btnH = 50; const btnX = canvas.width/2 - btnW/2;
        let y = 250;
        UI.drawButton(ctx, 'PLAY', btnX, y, btnW, btnH, '#0a0', () => sceneManager.changeScene('HUB'), 'primary'); y+=70;
        UI.drawButton(ctx, 'SETTINGS', btnX, y, btnW, btnH, '#222', () => sceneManager.changeScene('SETTINGS')); y+=70;
        UI.drawButton(ctx, 'CREDITS', btnX, y, btnW, btnH, '#222', () => alert("Created by Montano Mickael, Founder of Logoloom")); y+=70;
        UI.drawButton(ctx, 'QUIT', btnX, y, btnW, btnH, '#500', () => window.close());

        UI.handleInput(input);
    } else if (currentScene === 'HUB') {
        drawGridBackground(ts * 0.02);

        // Main Panel
        const panelW = Math.min(500, canvas.width - 40);
        const panelH = Math.min(600, canvas.height - 40);
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;

        UI.drawPanel(ctx, panelX, panelY, panelW, panelH, '#111', 'THE SANCTUARY');

        ctx.textAlign='left';
        ctx.fillStyle='#ff0';
        ctx.font='24px monospace';
        ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, panelX + 20, panelY + 50);

        let y = panelY + 100;
        const btnW = panelW - 60;
        const btnX = panelX + 30;
        const gap = 70;

        UI.drawButton(ctx, 'ENTER THE GLITCH', btnX, y, btnW, 50, '#a0a', () => { if(GameData.progress.storySeen) startGame(); else sceneManager.changeScene('STORY'); storyY=canvas.height; }, 'primary');
        y += gap;
        UI.drawButton(ctx, 'CHARACTER SELECT', btnX, y, btnW, 50, '#333', () => sceneManager.changeScene('WARDROBE'));
        y += gap;
        UI.drawButton(ctx, 'UPGRADE SHOP', btnX, y, btnW, 50, '#333', () => sceneManager.changeScene('SHOP'));
        y += gap;
        UI.drawButton(ctx, 'ARCHIVES', btnX, y, btnW, 50, '#333', () => sceneManager.changeScene('ARCHIVES'));
        y += gap;
        UI.drawButton(ctx, 'TROPHIES', btnX, y, btnW, 50, '#333', () => sceneManager.changeScene('TROPHIES'));

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', () => sceneManager.changeScene('TITLE'));
        UI.handleInput(input);
    } else if (currentScene === 'ARCHIVES') {
        drawGridBackground(ts * 0.02);
        const panelW = Math.min(600, canvas.width - 40);
        const panelH = canvas.height - 100;
        UI.drawPanel(ctx, (canvas.width-panelW)/2, 50, panelW, panelH, '#111', 'ARCHIVES');

        let y=120;
        const types = Object.keys(GameData.progress.bestiary);
        if(types.length===0) { ctx.font='20px monospace'; ctx.textAlign='center'; ctx.fillText("NO DATA COLLECTED", canvas.width/2, 200); }
        else {
            ctx.font='24px monospace'; ctx.fillStyle='#ccc';
            types.forEach(t => {
                ctx.textAlign='left';
                ctx.fillText(`${t}: ${GameData.progress.bestiary[t]} KILLS`, (canvas.width-panelW)/2 + 40, y);
                y+=40;
            });
        }
        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'TROPHIES') {
        drawGridBackground(ts * 0.02);
        const panelW = Math.min(600, canvas.width - 40);
        const panelH = canvas.height - 100;
        UI.drawPanel(ctx, (canvas.width-panelW)/2, 50, panelW, panelH, '#111', 'TROPHIES');

        const startX = (canvas.width-panelW)/2 + 40;
        let y=120;

        ctx.textAlign='left'; ctx.fillStyle='#fff';
        ctx.fillText(`HIGH SCORE: ${GameData.progress.highScore}`, startX, y); y+=50;

        const kills = GameData.progress.bestiary ? Object.values(GameData.progress.bestiary).reduce((a,b)=>a+b,0) : 0;
        ctx.fillText(`TOTAL KILLS: ${kills}`, startX, y); y+=50;
        ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, startX, y); y+=50;

        const achs = [
            {name: "First Blood", done: kills > 0},
            {name: "Survivor", done: GameData.progress.highScore > 1000},
            {name: "Glitch Hunter", done: GameData.progress.nemesis === null && GameData.progress.storySeen},
            {name: "Rich", done: GameData.progress.currency > 1000}
        ];
        achs.forEach(a => {
            ctx.fillStyle = a.done ? '#0f0' : '#555';
            ctx.fillText(`[${a.done?'X':' '}] ${a.name}`, startX, y);
            y+=40;
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'WARDROBE') {
        drawGridBackground(ts * 0.02);

        // Single column list, centered
        const keys = Object.keys(CHARACTERS);
        const itemH = 100;

        // Simple pagination logic
        if (!window.wardrobePage) window.wardrobePage = 0;
        const itemsPerPage = 4; // reduced for larger cards
        const totalPages = Math.ceil(keys.length / itemsPerPage);

        const startIdx = window.wardrobePage * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, keys.length);

        const listH = itemsPerPage * (itemH + 10);
        const panelY = (canvas.height - listH) / 2;

        UI.drawPanel(ctx, (canvas.width - 600)/2, panelY - 60, 600, listH + 120, '#111', 'SELECT CHARACTER');

        let y = panelY;
        for(let i=startIdx; i<endIdx; i++) {
            const k = keys[i];
            const c = CHARACTERS[k];
            const u = GameData.progress.unlockedChars.includes(k);
            const s = selectedCharacter === k;

            const bx = (canvas.width - 560) / 2;

            // Draw Item Panel
            UI.drawPanel(ctx, bx, y, 560, itemH, s ? '#242' : '#222'); // Greenish if selected

            // Sprite Preview
            const img = world.images['PLAYER_STAND'];
            if (img) {
                ctx.drawImage(img, bx + 20, y + 20, 60, 60);
                // Color indicator
                ctx.fillStyle = c.color;
                ctx.fillRect(bx + 65, y + 65, 15, 15);
                ctx.strokeStyle = '#fff'; ctx.strokeRect(bx + 65, y + 65, 15, 15);
            }

            ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='bold 22px monospace';
            ctx.fillText(c.name, bx + 100, y + 35);
            ctx.font='16px monospace'; ctx.fillStyle='#aaa';
            ctx.fillText(c.desc, bx + 100, y + 60);

            const btnX = bx + 400;
            const btnY = y + 25;

            if(u){
                if(!s) UI.drawButton(ctx, 'SELECT', btnX, btnY, 140, 50, '#00a', ()=>selectedCharacter=k);
                else { ctx.fillStyle='#0f0'; ctx.font='bold 20px monospace'; ctx.textAlign='center'; ctx.fillText("EQUIPPED", btnX + 70, btnY + 25); }
            } else if(GameData.progress.currency>=c.price) {
                UI.drawButton(ctx, `$${c.price}`, btnX, btnY, 140, 50, '#0a0', ()=>{GameData.progress.currency-=c.price; GameData.progress.unlockedChars.push(k); GameData.saveProgress();});
            } else {
                ctx.fillStyle='#555'; ctx.textAlign='center'; ctx.fillText(`LOCKED`, btnX + 70, btnY + 15);
                ctx.fillText(`$${c.price}`, btnX + 70, btnY + 35);
            }
            y += itemH + 10;
        }

        // Pagination Controls
        if (totalPages > 1) {
            const py = y + 20;
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '20px monospace';
            ctx.fillText(`PAGE ${window.wardrobePage + 1}/${totalPages}`, canvas.width/2, py + 25);
            if (window.wardrobePage > 0) UI.drawButton(ctx, '<', canvas.width/2 - 120, py, 60, 40, '#444', () => window.wardrobePage--);
            if (window.wardrobePage < totalPages - 1) UI.drawButton(ctx, '>', canvas.width/2 + 60, py, 60, 40, '#444', () => window.wardrobePage++);
        }

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'PLAYING') {
        updateGame(dt); render();
    } else if (currentScene === 'CHALLENGE') {
        render(); // Render game world in background
        challengeTimer -= dt;

        // Challenge Logic: Survive
        // Spawn intensity maxed out
        gameTime += dt * 5; // Fast forward difficulty scaling locally

        ctx.fillStyle = 'rgba(50, 0, 50, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#f0f'; ctx.font = '40px monospace'; ctx.textAlign='center';
        ctx.fillText(`SURVIVE! ${Math.ceil(challengeTimer)}`, canvas.width/2, 100);

        // Spawn waves rapidly
        if (Math.random() < 0.1) {
             const a = Math.random()*6.28;
             const r = 400;
             enemyPool.get().init('SWARMER', player.x+Math.cos(a)*r, player.y+Math.sin(a)*r);
        }

        // Reuse updateGame logic but maybe skip some timers?
        // Just calling updateGame works to keep things moving, but we want custom rules.
        // Let's manually update entities to enforce "Challenge" state rules if complex.
        // For simple survival, updateGame is fine, but we need to ensure boss doesn't spawn on top.
        updateGame(dt);

        if (challengeTimer <= 0) {
            // Success
            sceneManager.changeScene('PLAYING');
            spawnDamageText("CHALLENGE COMPLETE!", player.x, player.y - 50, true);
            spawnGem(player.x, player.y - 100, 500, true); // Big money reward
            audioController.setBossMode(false);
            // Clear screen of enemies
            enemyPool.active.forEach(e => e.die());
        }
        if (player.hp <= 0) {
            // Fail handled by player.takeDamage -> endGame
        }
        UI.handleInput(input);

    } else if (currentScene === 'LEVEL_UP') {
        render(); ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.fillStyle='#fff'; ctx.font='40px monospace'; ctx.textAlign='center';
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

        UI.drawPanel(ctx, canvas.width/2 - 250, 50, 500, canvas.height - 100, '#111', 'PAUSED');

        // Show Stats
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace'; ctx.textAlign = 'left';
        let y = 140;
        const startX = canvas.width/2 - 200;

        ctx.fillText("--- WEAPONS ---", startX, y);
        y+=30;
        player.weapons.forEach(w => {
            // Friendly Name Logic could be extracted
            const name = w.type.replace('_', ' ');
            ctx.fillText(`${name} Lv.${w.level} (Dmg: ${Math.floor(w.damage * player.damageMult)})`, startX, y);
            y+=25;
        });

        y += 20;
        ctx.fillText("--- STATS ---", startX, y);
        y+=30;
        ctx.fillText(`HP: ${Math.floor(player.hp)}/${player.maxHp}`, startX, y); y+=25;
        ctx.fillText(`LVL: ${player.level} (XP: ${player.xp}/${player.nextLevelXp})`, startX, y); y+=25;
        ctx.fillText(`DMG MULT: x${player.damageMult.toFixed(2)}`, startX, y); y+=25;
        ctx.fillText(`FIRE RATE: x${(1/player.fireRateMult).toFixed(2)}`, startX, y); y+=25;
        ctx.fillText(`SPEED: ${Math.floor(player.speed)}`, startX, y); y+=25;

        UI.drawButton(ctx, 'RESUME', canvas.width/2-160, canvas.height-180, 150, 50, '#0a0', () => sceneManager.changeScene('PLAYING'));
        UI.drawButton(ctx, 'QUIT', canvas.width/2+10, canvas.height-180, 150, 50, '#a00', () => sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'GAME_OVER') {
        render(); ctx.fillStyle='rgba(50,0,0,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height);

        const panelW = 400; const panelH = 300;
        const px = (canvas.width - panelW) / 2;
        const py = (canvas.height - panelH) / 2;
        UI.drawPanel(ctx, px, py, panelW, panelH, '#200', 'CRITICAL FAILURE');

        UI.drawButton(ctx, 'RETRY', canvas.width/2-100, py+100, 200, 60, '#fff', ()=>startGame(), 'primary');
        UI.drawButton(ctx, 'RETURN', canvas.width/2-100, py+180, 200, 60, '#333', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'STORY') {
        ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
        storyY-=50*dt; let y=storyY;
        const txt=["THE LOOM...", "IS UNRAVELING.", "", "YOU ARE THE LAST.", "SURVIVE."];
        ctx.fillStyle='#0ff'; ctx.textAlign='center';
        txt.forEach(l=>{ctx.fillText(l, canvas.width/2, y); y+=50;});
        if(y<0 || input.taps.length>0) { GameData.progress.storySeen=true; GameData.saveProgress(); startGame(); }
    } else if (currentScene === 'SHOP') {
        drawGridBackground(ts * 0.02);

        // Main Shop Panel
        const panelW = Math.min(700, canvas.width - 40);
        const panelH = Math.min(700, canvas.height - 40);
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;

        UI.drawPanel(ctx, panelX, panelY, panelW, panelH, '#111', 'UPGRADE SHOP');

        ctx.fillStyle='#ff0'; ctx.font='24px monospace'; ctx.textAlign='right';
        ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, panelX + panelW - 30, panelY + 50);

        let y = panelY + 100;
        const upgrades = [
            { id: 'health', name: 'MAX HP', cost: 100 },
            { id: 'damage', name: 'DAMAGE', cost: 150 },
            { id: 'magnet', name: 'MAGNET', cost: 100 }
        ];

        upgrades.forEach(u => {
             const lvl = GameData.progress.upgrades[u.id] || 0;
             const cost = u.cost * (lvl + 1);

             // Draw Item Panel
             const itemH = 100;
             UI.drawPanel(ctx, panelX + 30, y, panelW - 60, itemH, '#222');

             ctx.fillStyle='#fff'; ctx.textAlign='left';
             ctx.font='bold 24px monospace';
             ctx.fillText(`${u.name}`, panelX + 50, y + 40);
             ctx.fillStyle='#aaa'; ctx.font='18px monospace';
             ctx.fillText(`Level ${lvl}`, panelX + 50, y + 70);

             if (GameData.progress.currency >= cost) {
                 UI.drawButton(ctx, `UPGRADE ($${cost})`, panelX + panelW - 220, y + 25, 180, 50, '#0a0', () => {
                     GameData.progress.currency -= cost;
                     GameData.progress.upgrades[u.id]++;
                     GameData.saveProgress();
                 });
             } else {
                 // Disabled button look
                 const btnX = panelX + panelW - 220;
                 const btnY = y + 25;
                 ctx.fillStyle='#444'; ctx.fillRect(btnX, btnY, 180, 50);
                 ctx.strokeStyle='#666'; ctx.strokeRect(btnX, btnY, 180, 50);
                 ctx.fillStyle='#888'; ctx.textAlign='center';
                 ctx.fillText(`$${cost}`, btnX + 90, btnY + 30);
             }
             y += itemH + 20;
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'SETTINGS') {
        drawGridBackground(ts * 0.02);
        const panelW = Math.min(600, canvas.width - 40);
        const panelH = 500;
        const panelX = (canvas.width - panelW) / 2;
        const panelY = (canvas.height - panelH) / 2;

        UI.drawPanel(ctx, panelX, panelY, panelW, panelH, '#111', 'SETTINGS');

        let y = panelY + 80;
        const controlW = panelW - 60;
        const controlX = panelX + 30;

        UI.drawSlider(ctx, 'MASTER VOLUME', GameData.settings.masterVolume, controlX, y, controlW, 30, (val) => {
            GameData.settings.masterVolume = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawToggle(ctx, 'CRT EFFECT', GameData.settings.crtEffect, controlX, y, controlW, 40, (val) => {
            GameData.settings.crtEffect = val;
            GameData.saveSettings();
        });
        y += 80;

        UI.drawSelector(ctx, 'PARTICLES', ['Low', 'Medium', 'High'], GameData.settings.particles, controlX, y, controlW, 40, (val) => {
            GameData.settings.particles = val;
            GameData.saveSettings();
        });
        y += 80;

        // Joystick settings need to fit, maybe scroll or tighten spacing?
        // Let's just fit them for now.
        UI.drawToggle(ctx, 'HARDCORE (1 HP)', GameData.settings.hardcore, controlX, y, controlW, 40, (val) => {
            GameData.settings.hardcore = val;
            GameData.saveSettings();
        });

        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 120, 50, '#444', ()=>sceneManager.changeScene('TITLE'));
        UI.handleInput(input);
    }

    input.clearTaps();
    requestAnimationFrame(gameLoop);
}

function drawGridBackground(offset) {
    ctx.strokeStyle='rgba(0, 255, 255, 0.2)'; ctx.lineWidth=1; ctx.beginPath();
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
    // Card Background via UI Panel
    UI.drawPanel(ctx, x, y, w, h, '#222');

    // Placeholder Icon
    const iconSize = Math.min(w * 0.3, h * 0.3);
    const iconX = x + (w - iconSize) / 2;
    const iconY = y + 20;
    ctx.fillStyle = '#444';
    ctx.fillRect(iconX, iconY, iconSize, iconSize);
    ctx.strokeStyle = '#0ff';
    ctx.strokeRect(iconX, iconY, iconSize, iconSize);
    ctx.fillStyle = '#0ff'; ctx.font = '40px monospace'; ctx.textAlign='center';
    ctx.fillText("?", iconX + iconSize/2, iconY + iconSize/2 + 10);

    // Title
    const isStat = ['HEAL','MULTISHOT','ATK_SPEED','DMG_UP','SPEED_UP'].includes(upgrade.id);
    const hasWep = player.weapons.some(w => w.type === upgrade.id);
    const prefix = (!isStat && !hasWep) ? "NEW! " : (hasWep ? "LVL UP! " : "");

    ctx.fillStyle = '#ff0'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillText(prefix + upgrade.title, x + w/2, iconY + iconSize + 30);

    // Description
    ctx.fillStyle = '#ccc'; ctx.font = '16px monospace';
    // Wrap text if needed? For now simple
    ctx.fillText(upgrade.desc, x + w/2, iconY + iconSize + 60);

    // Register Button
    UI.registerArea(x, y, w, h, action);
}
