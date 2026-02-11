import { CHARACTERS, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';
import { GameData, ObjectPool, checkRectCollide } from './utils.js';
import { audioController } from './audio.js';
import { sceneManager } from './game.js';

// --- GAME ENTITIES ---

// STATIC OBJECT
export class StaticObject {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 64;
        this.height = 64;
        this.solid = false;

        if (type === 'TREE') {
            // Trees are obstacles
            this.solid = true;
            // Collision box is smaller (trunk)
            this.colOffsetX = 20;
            this.colOffsetY = 40;
            this.colW = 24;
            this.colH = 20;
        } else {
            // Bushes etc
            this.colOffsetX = 10;
            this.colOffsetY = 10;
            this.colW = 44;
            this.colH = 44;
        }
    }
}
export const staticObjects = [];

// PLAYER
export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 20;
        this.height = 20;
        this.speed = 200;
        this.hp = 100;
        this.maxHp = 100;
        this.xp = 0;
        this.nextLevelXp = 10;
        this.level = 1;
        this.weapons = []; // Array of weapon config objects
        this.passives = []; // Array of {id, level}
        this.drones = []; // Array of Drone objects
        this.iframeTimer = 0;
        this.color = '#0ff';
        this.damageMult = 1.0;
        this.fireRateMult = 1.0;

        // Animation
        this.animTimer = 0;
        this.isMoving = false;
        this.facingRight = true;
        this.frameIndex = 1; // 1-3 for walking
        this.state = 'STAND';

        // Overdrive
        this.glitchMeter = 0;
        this.glitchMax = 100;
        this.overdriveActive = false;
        this.overdriveTimer = 0;

        // Init with Neon Wand
        this.addWeapon('NEON_WAND');
    }

    reset(selectedCharacter) {
        const charConfig = CHARACTERS[selectedCharacter] || CHARACTERS.WEAVER;

        // Apply Permanent Upgrades + Character Stats
        this.maxHp = 100 + (GameData.progress.upgrades.health * 10) + (charConfig.hpBonus || 0);
        this.damageMult = 1.0 + (GameData.progress.upgrades.damage * 0.05) + (charConfig.dmgBonus || 0);
        const magnetRange = 100 + (GameData.progress.upgrades.magnet * 20);

        this.x = WORLD_WIDTH / 2; // Center of world
        this.y = WORLD_HEIGHT / 2;
        this.hp = this.maxHp;
        this.speed = 200 + (charConfig.speedBonus || 0);
        this.xp = 0;
        this.nextLevelXp = 10;
        this.level = 1;
        this.iframeTimer = 0;
        this.weapons = [];
        this.passives = [];
        this.drones = [];
        this.fireRateMult = 1.0;

        this.glitchMeter = 0;
        this.overdriveActive = false;

        // Skin Colors
        this.color = charConfig.color;

        this.addWeapon(charConfig.weapon);
    }

    activateOverdrive() {
        if (this.glitchMeter >= this.glitchMax && !this.overdriveActive) {
            this.overdriveActive = true;
            this.overdriveTimer = 5.0;
            this.glitchMeter = 0;
            sceneManager.addShake(20);
        }
    }

    addPassive(id) {
        const existing = this.passives.find(p => p.id === id);
        if (existing) existing.level++;
        else this.passives.push({ id: id, level: 1 });

        // Apply Passive Effects
        if (id === 'MIGHT') this.damageMult += 0.1;
        else if (id === 'HASTE') this.fireRateMult *= 0.9;
        else if (id === 'SPEED') this.speed += 20;
        else if (id === 'ARMOR') { this.maxHp += 20; this.hp += 20; }
        else if (id === 'CURSED_HEART') { this.maxHp -= 50; this.damageMult += 0.5; this.hp = Math.min(this.hp, this.maxHp); }
        else if (id === 'GLASS_CANNON') { this.maxHp = 1; this.damageMult += 1.0; this.hp = 1; }
    }

    addDrone() {
        this.drones.push(new Drone(this.drones.length));
    }

    addWeapon(type) {
        const weaponConfig = {
            type: type,
            cooldown: 0,
            level: 1,
            evolved: false
        };

        if (type === 'NEON_WAND') {
            weaponConfig.fireRate = 0.5;
            weaponConfig.damage = 10;
        } else if (type === 'DATA_ORBIT') {
            weaponConfig.fireRate = 0;
            weaponConfig.damage = 5;
            weaponConfig.angle = 0;
        } else if (type === 'GLITCH_BOMB') {
            weaponConfig.fireRate = 2.0;
            weaponConfig.damage = 30;
        } else if (type === 'PIXEL_RAIL') {
            weaponConfig.fireRate = 1.5; weaponConfig.damage = 50;
        } else if (type === 'VOID_AXE') {
            weaponConfig.fireRate = 1.0; weaponConfig.damage = 60;
        } else if (type === 'FORCE_FIELD') {
            weaponConfig.fireRate = 2.0; weaponConfig.damage = 15;
        }

        this.weapons.push(weaponConfig);
    }

    update(dt, input) {
        let speedMult = 1.0;
        let fireRateMult = 1.0;

        if (this.overdriveActive) {
            this.overdriveTimer -= dt;
            speedMult = 2.0;
            fireRateMult = 2.0;
            this.iframeTimer = 0.1;

            if (this.overdriveTimer <= 0) {
                this.overdriveActive = false;
                sceneManager.increaseCorruption();
            }
        }

        const moveVec = input.getMovementVector();

        this.isMoving = moveVec.x !== 0 || moveVec.y !== 0;
        if (moveVec.x !== 0) {
            this.facingRight = moveVec.x > 0;
        }

        // Animation Update
        this.animTimer += dt;
        if (this.isMoving) {
            this.state = 'WALK';
            if (this.animTimer > 0.15) {
                this.animTimer = 0;
                this.frameIndex++;
                if (this.frameIndex > 3) this.frameIndex = 1;
            }
        } else {
            this.state = 'STAND';
            this.frameIndex = 1;
        }

        // Move X
        this.x += moveVec.x * this.speed * speedMult * dt;
        // Infinite World: No clamping

        // Collision X
        if (moveVec.x !== 0) {
            for (const obj of staticObjects) {
                if (obj.solid) {
                    if (checkRectCollide(this, {x: obj.x + obj.colOffsetX, y: obj.y + obj.colOffsetY, width: obj.colW, height: obj.colH})) {
                        if (moveVec.x > 0) this.x = obj.x + obj.colOffsetX - this.width;
                        else this.x = obj.x + obj.colOffsetX + obj.colW;
                    }
                }
            }
        }

        // Move Y
        this.y += moveVec.y * this.speed * speedMult * dt;
        // Infinite World: No clamping

        // Collision Y
        if (moveVec.y !== 0) {
            for (const obj of staticObjects) {
                if (obj.solid) {
                    if (checkRectCollide(this, {x: obj.x + obj.colOffsetX, y: obj.y + obj.colOffsetY, width: obj.colW, height: obj.colH})) {
                        if (moveVec.y > 0) this.y = obj.y + obj.colOffsetY - this.height;
                        else this.y = obj.y + obj.colOffsetY + obj.colH;
                    }
                }
            }
        }

        if (this.iframeTimer > 0) {
            this.iframeTimer -= dt;
        }

        this.weapons.forEach(w => {
            if (w.type === 'DATA_ORBIT') {
                w.angle += 3 * dt * fireRateMult;
            } else if (w.type === 'STORM_ORBIT') {
                w.angle += 8 * dt * fireRateMult; // Much faster
            } else {
                w.cooldown -= dt * fireRateMult;
                if (w.cooldown <= 0) {
                    this.fireWeapon(w);
                }
            }
        });

        this.drones.forEach(d => d.update(dt, this));
    }

    fireWeapon(w) {
        // Will be wired in game.js via callback or event,
        // OR we export a global function. V5 used global.
        // We'll export a function `fireWeaponGlobal` from here that needs context.
        // Actually, entities shouldn't depend on game.js loop context directly.
        // But for strict fractioning, we need to replicate V5 structure.
        if (window.fireWeaponGlobal) window.fireWeaponGlobal(this, w);
    }

    takeDamage(amount) {
        if (this.iframeTimer > 0) return;
        this.hp -= amount;
        this.iframeTimer = 0.5;

        if (this.hp <= 0) {
            sceneManager.endGame();
        }
    }

    gainXp(amount) {
        this.xp += amount;
        audioController.playPing();
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
    }

    levelUp() {
        this.xp -= this.nextLevelXp;
        this.level++;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
        audioController.playLevelUp();
        sceneManager.triggerLevelUpScreen();
    }
}

export const player = new Player();

// ENEMY
export class Enemy {
    constructor() {
        this.active = false;
        this.x = 0; this.y = 0;
        this.width = 20; this.height = 20;
        this.hp = 10; this.maxHp = 10;
        this.speed = 50;
        this.type = 'SWARMER';
        this.color = '#f00';
        this.knockbackX = 0; this.knockbackY = 0;
        this.attackTimer = 0;

        // Anim
        this.animTimer = 0;
        this.frameIndex = 1;
        this.state = 'STAND';
        this.facingRight = true;
    }

    init(type, x, y) {
        this.active = true;
        this.x = x; this.y = y;
        this.type = type;
        this.knockbackX = 0; this.knockbackY = 0;
        this.flashTimer = 0; this.attackTimer = 0;
        this.frameIndex = 1;
        this.state = 'WALK'; // Default state for enemies

        if (type === 'SWARMER') {
            this.width = 15; this.height = 15;
            this.hp = 10 + (player.level * 2);
            this.speed = 80 + (player.level * 2);
            this.color = '#f00';
        } else if (type === 'TANK') {
            this.width = 30; this.height = 30;
            this.hp = 50 + (player.level * 10);
            this.speed = 40;
            this.color = '#900';
        } else if (type === 'GLITCH_MITE') {
            this.width = 12; this.height = 12;
            this.hp = 5 + (player.level * 1);
            this.speed = 120;
            this.color = '#ff0';
        } else if (type === 'WARDEN') {
            this.width = 60; this.height = 60;
            this.hp = 5000 + (player.level * 100);
            this.maxHp = this.hp;
            this.speed = 60;
            this.color = '#f0f';
        }
    }

    update(dt) {
        if (!this.active) return;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (Math.abs(this.knockbackX) > 1 || Math.abs(this.knockbackY) > 1) {
            this.x += this.knockbackX * dt;
            this.y += this.knockbackY * dt;
            this.knockbackX *= 0.9;
            this.knockbackY *= 0.9;
        } else {
            let sepX = 0, sepY = 0;
            if (this.type !== 'WARDEN') {
                let checks = 0;
                for (const other of enemyPool.active) {
                    if (checks > 10) break;
                    if (other === this || other.type === 'WARDEN') continue;
                    const dx = this.x - other.x;
                    const dy = this.y - other.y;
                    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
                    const distSq = dx*dx + dy*dy;
                    if (distSq < 900 && distSq > 0) {
                         const dist = Math.sqrt(distSq);
                         const force = (30 - dist) / 30;
                         sepX += (dx / dist) * force * 100;
                         sepY += (dy / dist) * force * 100;
                         checks++;
                    }
                }
            }

            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let moveX = 0, moveY = 0;
            if (dist > 0) { moveX = (dx / dist) * this.speed; moveY = (dy / dist) * this.speed; }

            // Static Collision for enemies (Simple resolve)
            // Predict movement
            const nextX = this.x + (moveX + sepX) * dt;
            const nextY = this.y + (moveY + sepY) * dt;

            let hit = false;
            for (const obj of staticObjects) {
                if (obj.solid) {
                    if (checkRectCollide({x: nextX, y: nextY, width: this.width, height: this.height},
                        {x: obj.x + obj.colOffsetX, y: obj.y + obj.colOffsetY, width: obj.colW, height: obj.colH})) {
                        hit = true;
                        break;
                    }
                }
            }
            // If hit tree, just slide or stop? Simplest is to not move or slide.
            // Let's just reduce speed or slide.
            // Split axis for enemies too? Maybe too expensive for 200 enemies.
            // Let's just block them if they hit a tree.
            if (hit) {
                // Try sliding X
                 if (!checkRectCollide({x: nextX, y: this.y, width: this.width, height: this.height},
                        {x: 0, y: 0, width: 0, height: 0})) { // Hacky check? No.
                    // Just basic avoidance:
                    moveX = -moveY; moveY = moveX; // Turn 90 deg?
                 }
                 // Simple: Don't move into wall
                 // Actually, swarmers should probably just flow around.
                 // Let's skip static collision for small enemies for performance/gameplay flow?
                 // User said "trees should be obstacle". Usually applies to player.
                 // If enemies clip through trees it looks bad.
                 // Let's apply a soft push force away from trees.
            }

            // Re-implement soft collision with trees
             for (const obj of staticObjects) {
                if (obj.solid) {
                    // Check dist to center of tree base
                    const treeCx = obj.x + obj.colOffsetX + obj.colW/2;
                    const treeCy = obj.y + obj.colOffsetY + obj.colH/2;
                    const eCx = this.x + this.width/2;
                    const eCy = this.y + this.height/2;
                    const ddx = eCx - treeCx;
                    const ddy = eCy - treeCy;
                    const d2 = ddx*ddx + ddy*ddy;
                    const rad = (obj.colW/2 + this.width/2);
                    if (d2 < rad*rad) {
                        const d = Math.sqrt(d2) || 1;
                        sepX += (ddx/d) * 200; // Strong push out
                        sepY += (ddy/d) * 200;
                    }
                }
            }

            // Animation Update for Enemies
            this.animTimer += dt;
            if (this.animTimer > 0.2) {
                this.animTimer = 0;
                this.frameIndex++;
                if (this.frameIndex > 3) this.frameIndex = 1;
            }
            if (moveX > 0) this.facingRight = true;
            else if (moveX < 0) this.facingRight = false;


            if (this.type === 'WARDEN') {
                this.attackTimer += dt;
                const attackRate = (this.hp < this.maxHp * 0.5) ? 1.0 : 2.0;
                if (this.attackTimer > attackRate) {
                    this.attackTimer = 0;
                    // Trigger Attack Animation state here if we had logic for it
                    for (let i = -1; i <= 1; i++) {
                        projectilePool.get().init('BOSS_ORB', this.x + this.width/2, this.y + this.height/2, player.x + (i*50), player.y + (i*50), 20, true);
                    }
                    audioController.playCrunch();
                }
            } else if (this.type === 'TANK') {
                 if (Math.random() < 0.05) spawnParticle(this.x + this.width/2, this.y + this.height/2, '#500');
            }
            this.x += (moveX + sepX) * dt;
            this.y += (moveY + sepY) * dt;
        }
    }

    takeDamage(amount, knockbackForce = 0, sourceX, sourceY, isCrit = false) {
        this.hp -= amount;
        this.flashTimer = 0.1;
        if (knockbackForce > 0) {
            const dx = this.x - sourceX;
            const dy = this.y - sourceY;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            this.knockbackX = (dx/dist) * knockbackForce;
            this.knockbackY = (dy/dist) * knockbackForce;
        }
        spawnDamageText(amount, this.x, this.y, isCrit);
        if (this.hp <= 0) this.die();
    }

    die() {
        this.active = false;
        audioController.playCrunch();
        enemyPool.release(this);

        if (Math.random() < 0.1) spawnGem(this.x, this.y, 10, true);
        else spawnGem(this.x, this.y, this.type === 'TANK' ? 5 : 1, false);

        if (player.glitchMeter < player.glitchMax) player.glitchMeter++;

        const pCount = GameData.settings.particles === 'High' ? 5 : 2;
        for(let i=0; i<pCount; i++) spawnParticle(this.x, this.y, this.color);
        sceneManager.addScore(this.type === 'TANK' ? 50 : 10);
        if(sceneManager.recordKill) sceneManager.recordKill(this.type);

        if (this.type === 'WARDEN') {
            sceneManager.onBossDeath();
        }

        if (this.isNemesis) {
            player.gainXp(100);
            GameData.progress.nemesis = null;
            GameData.saveProgress();
            spawnDamageText("NEMESIS DEFEATED!", this.x, this.y - 30);
        }
    }
}

export const enemyPool = new ObjectPool(() => new Enemy(), 200);

// PROJECTILE
export class Projectile {
    constructor() {
        this.active = false;
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.width = 10; this.height = 10;
        this.damage = 10;
        this.duration = 2;
        this.type = 'NEON_WAND';
        this.penetrate = false;
        this.isEnemy = false;
    }

    init(type, x, y, targetX, targetY, damage, isEnemy = false) {
        this.active = true;
        this.type = type;
        this.x = x; this.y = y;
        this.damage = damage;
        this.duration = 3;
        this.penetrate = false;
        this.isEnemy = isEnemy;

        // Default Aim Vector
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const dirX = dx/dist;
        const dirY = dy/dist;

        if (type === 'NEON_WAND') {
            this.width = 8; this.height = 8;
            const speed = 400;
            this.vx = dirX * speed; this.vy = dirY * speed;
        } else if (type === 'HOLY_BEAM') {
            this.width = 12; this.height = 12;
            const speed = 600;
            this.vx = dirX * speed; this.vy = dirY * speed;
            this.penetrate = true; // Penetrates enemies
            this.duration = 2.0;
        } else if (type === 'GLITCH_BOMB' || type === 'CLUSTER_BOMB') {
            this.width = 16; this.height = 16;
            const speed = 200;
            this.vx = dirX * speed; this.vy = dirY * speed;
        } else if (type === 'PIXEL_RAIL') {
            this.width = 4; this.height = 4;
            const speed = 800;
            this.vx = dirX * speed; this.vy = dirY * speed;
            this.penetrate = true;
            this.duration = 1.0;
        } else if (type === 'VOID_AXE') {
            this.width = 40; this.height = 40;
            const speed = 250;
            this.vx = dirX * speed; this.vy = dirY * speed;
            this.duration = 1.5;
            this.penetrate = true;
        } else if (type === 'FORCE_FIELD') {
            this.width = 60; this.height = 60;
            const speed = 100;
            this.vx = dirX * speed; this.vy = dirY * speed;
            this.penetrate = true;
        } else if (type === 'BOSS_ORB') {
            this.width = 15; this.height = 15;
            const speed = 150;
            this.vx = dirX * speed; this.vy = dirY * speed;
            this.duration = 5;
        }
    }

    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.duration -= dt;
        if (this.duration <= 0) projectilePool.release(this);
    }
}

export const projectilePool = new ObjectPool(() => new Projectile(), 100);

// GEM
export class Gem {
    constructor() { this.active = false; }
    init(x, y, value, isData = false) {
        this.active = true; this.x = x; this.y = y; this.value = value; this.isData = isData;
        this.width = isData ? 12 : 8; this.height = isData ? 12 : 8;
    }
}
export const gemPool = new ObjectPool(() => new Gem(), 200);

// PARTICLE
export class Particle {
    constructor() { this.active = false; }
    init(x, y, color) {
        this.active = true; this.x = x; this.y = y; this.color = color;
        this.life = 0.5 + Math.random() * 0.5;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }
    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.vx *= 0.95; this.vy *= 0.95;
        this.life -= dt;
        if (this.life <= 0) particlePool.release(this);
    }
}
export const particlePool = new ObjectPool(() => new Particle(), 200);

// DAMAGE TEXT
export class DamageText {
    constructor() { this.active = false; }
    init(amount, x, y, isCrit = false) {
        this.active = true; this.x = x; this.y = y;
        this.text = typeof amount === 'number' ? Math.floor(amount) : amount;
        this.life = 0.8;
        this.vx = (Math.random() - 0.5) * 20;
        this.isCrit = isCrit;
        this.fontSize = isCrit ? 40 : 30;
        this.color = isCrit ? '#f00' : '#fff';
    }
    update(dt) {
        if (!this.active) return;
        this.y -= 50 * dt; this.x += this.vx * dt;
        this.life -= dt;
        if (this.life <= 0) damageTextPool.release(this);
    }
}
export const damageTextPool = new ObjectPool(() => new DamageText(), 50);

// PORTAL
export class Portal {
    constructor() {
        this.active = false;
        this.x = 0; this.y = 0;
        this.width = 64; this.height = 64;
    }
    init(x, y) {
        this.active = true;
        this.x = x;
        this.y = y;
    }
}
export const portalPool = new ObjectPool(() => new Portal(), 5);

// HELPERS
export function spawnGem(x, y, value, isData = false) { gemPool.get().init(x, y, value, isData); }
export function spawnParticle(x, y, color) { particlePool.get().init(x, y, color); }
export function spawnDamageText(amount, x, y, isCrit = false) { damageTextPool.get().init(amount, x, y, isCrit); }
export function spawnPortal(x, y) { portalPool.get().init(x, y); }

// DRONE COMPANION
export class Drone {
    constructor(index) {
        this.index = index;
        this.type = 'BASE'; // BASE, HEAL, ATTACK, LOOT
        this.angle = (index * Math.PI * 2) / 3;
        this.distance = 50;
        this.cooldown = 0;
        this.fireRate = 1.0;
        this.x = 0;
        this.y = 0;
    }

    evolve(type) {
        this.type = type;
        if (type === 'DRONE_ATTACK') { this.fireRate = 0.3; }
        else if (type === 'DRONE_HEAL') { this.fireRate = 5.0; }
        else if (type === 'DRONE_LOOT') { this.distance = 100; this.fireRate = 0.5; }
    }

    update(dt, player) {
        // Orbit Logic
        this.angle += dt;
        let orbitDist = this.distance;
        let isLooting = false;

        // Loot behavior: move towards gem if close
        if (this.type === 'DRONE_LOOT') {
            let targetGem = null;
            let minGemDist = 400;
            for (const g of gemPool.active) {
                const dx = g.x - this.x;
                const dy = g.y - this.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d < minGemDist) { minGemDist = d; targetGem = g; }
            }

            if (targetGem) {
                isLooting = true;
                const dx = targetGem.x - this.x;
                const dy = targetGem.y - this.y;
                const d = Math.sqrt(dx*dx + dy*dy);
                if (d > 10) {
                    // Move fast
                    this.x += (dx/d) * 400 * dt;
                    this.y += (dy/d) * 400 * dt;
                } else {
                    // Pick it up for player (Snap to player logic)
                    targetGem.x = player.x; targetGem.y = player.y;
                }
            }
        }

        if (!isLooting) {
            this.x = player.x + player.width/2 + Math.cos(this.angle) * orbitDist - 12;
            this.y = player.y + player.height/2 + Math.sin(this.angle) * orbitDist - 12;
        }

        // Action Logic
        this.cooldown -= dt;
        if (this.cooldown <= 0) {
            if (this.type === 'BASE' || this.type === 'DRONE_ATTACK') {
                // Fire
                let nearest = null, minDist = 400;
                for (const e of enemyPool.active) {
                    const d = Math.sqrt((e.x-this.x)**2 + (e.y-this.y)**2);
                    if (d < minDist) { minDist = d; nearest = e; }
                }
                if (nearest) {
                    const dmg = this.type === 'DRONE_ATTACK' ? 15 : 5;
                    projectilePool.get().init('NEON_WAND', this.x, this.y, nearest.x+nearest.width/2, nearest.y+nearest.height/2, dmg);
                    this.cooldown = this.fireRate;
                }
            } else if (this.type === 'DRONE_HEAL') {
                // Heal Aura
                if (player.hp < player.maxHp) {
                    player.hp = Math.min(player.maxHp, player.hp + 5);
                    spawnDamageText("+5 HP", player.x, player.y - 20, false);
                    spawnParticle(player.x, player.y, '#0f0');
                    this.cooldown = 5.0;
                } else {
                    this.cooldown = 1.0;
                }
            }
        }
    }
}
