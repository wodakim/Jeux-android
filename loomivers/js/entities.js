import { CHARACTERS, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';
import { GameData, ObjectPool, checkRectCollide } from './utils.js';
import { audioController } from './audio.js';
import { sceneManager } from './game.js';

// --- GAME ENTITIES ---

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
        this.iframeTimer = 0;
        this.color = '#0ff';
        this.damageMult = 1.0;
        this.fireRateMult = 1.0;

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

    addWeapon(type) {
        const weaponConfig = {
            type: type,
            cooldown: 0,
            level: 1
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
        this.x += moveVec.x * this.speed * speedMult * dt;
        this.y += moveVec.y * this.speed * speedMult * dt;

        this.x = Math.max(0, Math.min(WORLD_WIDTH - this.width, this.x));
        this.y = Math.max(0, Math.min(WORLD_HEIGHT - this.height, this.y));

        if (this.iframeTimer > 0) {
            this.iframeTimer -= dt;
        }

        this.weapons.forEach(w => {
            if (w.type === 'DATA_ORBIT') {
                w.angle += 3 * dt * fireRateMult;
            } else {
                w.cooldown -= dt * fireRateMult;
                if (w.cooldown <= 0) {
                    this.fireWeapon(w);
                }
            }
        });
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
    }

    init(type, x, y) {
        this.active = true;
        this.x = x; this.y = y;
        this.type = type;
        this.knockbackX = 0; this.knockbackY = 0;
        this.flashTimer = 0; this.attackTimer = 0;

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

            if (this.type === 'WARDEN') {
                this.attackTimer += dt;
                const attackRate = (this.hp < this.maxHp * 0.5) ? 1.0 : 2.0;
                if (this.attackTimer > attackRate) {
                    this.attackTimer = 0;
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

    takeDamage(amount, knockbackForce = 0, sourceX, sourceY) {
        this.hp -= amount;
        this.flashTimer = 0.1;
        if (knockbackForce > 0) {
            const dx = this.x - sourceX;
            const dy = this.y - sourceY;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            this.knockbackX = (dx/dist) * knockbackForce;
            this.knockbackY = (dy/dist) * knockbackForce;
        }
        spawnDamageText(amount, this.x, this.y);
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
        } else if (type === 'GLITCH_BOMB') {
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
    init(amount, x, y) {
        this.active = true; this.x = x; this.y = y;
        this.text = typeof amount === 'number' ? Math.floor(amount) : amount;
        this.life = 0.8;
        this.vx = (Math.random() - 0.5) * 20;
    }
    update(dt) {
        if (!this.active) return;
        this.y -= 50 * dt; this.x += this.vx * dt;
        this.life -= dt;
        if (this.life <= 0) damageTextPool.release(this);
    }
}
export const damageTextPool = new ObjectPool(() => new DamageText(), 50);

// HELPERS
export function spawnGem(x, y, value, isData = false) { gemPool.get().init(x, y, value, isData); }
export function spawnParticle(x, y, color) { particlePool.get().init(x, y, color); }
export function spawnDamageText(amount, x, y) { damageTextPool.get().init(amount, x, y); }
