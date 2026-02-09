import { CHARACTERS, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';
import { GameData, ObjectPool, checkRectCollide } from './utils.js';
import { audioController } from './audio.js';
import { sceneManager, startGame } from './game.js';

// --- HELPER POOLS (Forward declaration to avoid circular dep if possible, but JS modules execute top-down)
// We need to export pools first or instantiate them.
// Circular dependency: Entities need GameContext (or global functions).
// Solution: Pass context or use global singletons. We will use the exported singleton pools.

// PLAYER
export class Player {
    constructor() {
        this.x = 0; this.y = 0;
        this.width = 20; this.height = 20;
        this.speed = 200;
        this.hp = 100; this.maxHp = 100;
        this.xp = 0; this.nextLevelXp = 10;
        this.level = 1;
        this.weapons = [];
        this.iframeTimer = 0;
        this.color = '#0ff';
        this.damageMult = 1.0;
        this.fireRateMult = 1.0;
        this.glitchMeter = 0; this.glitchMax = 100;
        this.overdriveActive = false; this.overdriveTimer = 0;
        this.addWeapon('NEON_WAND');
    }

    reset(selectedCharacter) {
        const charConfig = CHARACTERS[selectedCharacter];
        this.maxHp = 100 + (GameData.progress.upgrades.health * 10) + (charConfig.hpBonus || 0);
        this.damageMult = 1.0 + (GameData.progress.upgrades.damage * 0.05) + (charConfig.dmgBonus || 0);
        this.x = WORLD_WIDTH / 2; this.y = WORLD_HEIGHT / 2;
        this.hp = this.maxHp;
        this.speed = 200 + (charConfig.speedBonus || 0);
        this.xp = 0; this.nextLevelXp = 10; this.level = 1;
        this.iframeTimer = 0;
        this.weapons = [];
        this.fireRateMult = 1.0;
        this.glitchMeter = 0; this.overdriveActive = false;
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
        const w = { type: type, cooldown: 0, level: 1 };
        if (type === 'NEON_WAND') { w.fireRate = 0.5; w.damage = 10; }
        else if (type === 'DATA_ORBIT') { w.fireRate = 0; w.damage = 5; w.angle = 0; }
        else if (type === 'GLITCH_BOMB') { w.fireRate = 2.0; w.damage = 30; }
        else if (type === 'PIXEL_RAIL') { w.fireRate = 1.5; w.damage = 50; }
        else if (type === 'VOID_AXE') { w.fireRate = 1.0; w.damage = 60; }
        else if (type === 'FORCE_FIELD') { w.fireRate = 2.0; w.damage = 15; }
        this.weapons.push(w);
    }

    update(dt, input) {
        let speedMult = 1.0; let fireRateMult = 1.0;
        if (this.overdriveActive) {
            this.overdriveTimer -= dt;
            speedMult = 2.0; fireRateMult = 2.0; this.iframeTimer = 0.1;
            if (this.overdriveTimer <= 0) { this.overdriveActive = false; sceneManager.increaseCorruption(); }
        }

        const moveVec = input.getMovementVector();
        this.x += moveVec.x * this.speed * speedMult * dt;
        this.y += moveVec.y * this.speed * speedMult * dt;

        this.x = Math.max(0, Math.min(WORLD_WIDTH - this.width, this.x));
        this.y = Math.max(0, Math.min(WORLD_HEIGHT - this.height, this.y));

        if (this.iframeTimer > 0) this.iframeTimer -= dt;

        this.weapons.forEach(w => {
            if (w.type === 'DATA_ORBIT') w.angle += 3 * dt * fireRateMult;
            else {
                w.cooldown -= dt * fireRateMult;
                if (w.cooldown <= 0) this.fireWeapon(w);
            }
        });
    }

    fireWeapon(w) {
        // Logic to find nearest enemy is global? Or passed in?
        // We will call a global export from game.js? Or main.js?
        // Better: We implement fireWeaponGlobal here if we can access pools.
        fireWeaponLogic(this, w);
    }

    takeDamage(amount) {
        if (this.iframeTimer > 0) return;
        this.hp -= amount;
        this.iframeTimer = 0.5;
        if (this.hp <= 0) sceneManager.endGame();
    }

    gainXp(amount) {
        this.xp += amount;
        audioController.playPing();
        if (this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
            audioController.playLevelUp();
            sceneManager.triggerLevelUpScreen();
        }
    }
}

// ENEMY
export class Enemy {
    constructor() { this.active = false; }
    init(type, x, y) {
        this.active = true; this.x = x; this.y = y; this.type = type;
        this.knockbackX = 0; this.knockbackY = 0; this.flashTimer = 0; this.attackTimer = 0;

        if (type === 'SWARMER') { this.width = 15; this.height = 15; this.hp = 10 + (player.level * 2); this.speed = 80 + (player.level * 2); this.color = '#f00'; }
        else if (type === 'TANK') { this.width = 30; this.height = 30; this.hp = 50 + (player.level * 10); this.speed = 40; this.color = '#900'; }
        else if (type === 'GLITCH_MITE') { this.width = 12; this.height = 12; this.hp = 5 + (player.level * 1); this.speed = 120; this.color = '#ff0'; }
        else if (type === 'WARDEN') { this.width = 60; this.height = 60; this.hp = 5000 + (player.level * 100); this.maxHp = this.hp; this.speed = 60; this.color = '#f0f'; }
    }

    update(dt) {
        if (!this.active) return;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (Math.abs(this.knockbackX) > 1 || Math.abs(this.knockbackY) > 1) {
            this.x += this.knockbackX * dt; this.y += this.knockbackY * dt;
            this.knockbackX *= 0.9; this.knockbackY *= 0.9;
        } else {
            // Sep & Tracking
            let sepX = 0, sepY = 0;
            if (this.type !== 'WARDEN') {
                let checks = 0;
                for (const other of enemyPool.active) {
                    if (checks > 10) break;
                    if (other === this || other.type === 'WARDEN') continue;
                    const dx = this.x - other.x, dy = this.y - other.y;
                    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
                    const d2 = dx*dx + dy*dy;
                    if (d2 < 900 && d2 > 0) {
                        const d = Math.sqrt(d2);
                        sepX += (dx/d) * ((30-d)/30) * 100;
                        sepY += (dy/d) * ((30-d)/30) * 100;
                        checks++;
                    }
                }
            }
            const dx = player.x - this.x, dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            let moveX = 0, moveY = 0;
            if (dist > 0) { moveX = (dx/dist)*this.speed; moveY = (dy/dist)*this.speed; }

            if (this.type === 'WARDEN') {
                this.attackTimer += dt;
                const rate = (this.hp < this.maxHp * 0.5) ? 1.0 : 2.0;
                if (this.attackTimer > rate) {
                    this.attackTimer = 0;
                    for (let i = -1; i <= 1; i++) projectilePool.get().init('BOSS_ORB', this.x+this.width/2, this.y+this.height/2, player.x+(i*50), player.y+(i*50), 20, true);
                    audioController.playCrunch();
                }
            } else if (this.type === 'TANK') {
                if (Math.random() < 0.05) spawnParticle(this.x+this.width/2, this.y+this.height/2, '#500');
            }
            this.x += (moveX + sepX) * dt;
            this.y += (moveY + sepY) * dt;
        }
    }

    takeDamage(amount, kb = 0, sx, sy) {
        this.hp -= amount;
        this.flashTimer = 0.1;
        if (kb > 0) {
            const dx = this.x - sx, dy = this.y - sy;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            this.knockbackX = (dx/dist) * kb; this.knockbackY = (dy/dist) * kb;
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

        if (this.isNemesis) {
            player.gainXp(100);
            GameData.progress.nemesis = null;
            GameData.saveProgress();
            spawnDamageText("NEMESIS DEFEATED!", this.x, this.y - 30);
        }
    }
}

// PROJECTILE
export class Projectile {
    constructor() { this.active = false; }
    init(type, x, y, tx, ty, dmg, isEnemy = false) {
        this.active = true; this.type = type; this.x = x; this.y = y; this.damage = dmg;
        this.duration = 3; this.penetrate = false; this.isEnemy = isEnemy; this.vx = 0; this.vy = 0;

        const dx = tx - x, dy = ty - y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const dirX = dx/dist, dirY = dy/dist;

        if (type === 'NEON_WAND') {
            this.width = 8; this.height = 8;
            const speed = 400; this.vx = dirX*speed; this.vy = dirY*speed;
        } else if (type === 'GLITCH_BOMB') {
            this.width = 16; this.height = 16;
            const speed = 200; this.vx = dirX*speed; this.vy = dirY*speed;
        } else if (type === 'PIXEL_RAIL') {
            this.width = 4; this.height = 4;
            const speed = 800; this.vx = dirX*speed; this.vy = dirY*speed;
            this.penetrate = true; this.duration = 1.0;
        } else if (type === 'VOID_AXE') {
            this.width = 40; this.height = 40;
            const speed = 250; this.vx = dirX*speed; this.vy = dirY*speed;
            this.duration = 1.5; this.penetrate = true;
        } else if (type === 'FORCE_FIELD') {
            this.width = 60; this.height = 60;
            const speed = 100; this.vx = dirX*speed; this.vy = dirY*speed;
            this.penetrate = true;
        } else if (type === 'BOSS_ORB') {
            this.width = 15; this.height = 15;
            const speed = 150; this.vx = dirX*speed; this.vy = dirY*speed;
            this.duration = 5;
        }
    }

    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.duration -= dt;
        if (this.duration <= 0) projectilePool.release(this);
    }
}

// GEM, PARTICLE, DAMAGE TEXT
export class Gem { constructor() { this.active = false; } init(x, y, v, d) { this.active = true; this.x = x; this.y = y; this.value = v; this.isData = d; this.width = d?12:8; this.height = d?12:8; } }
export class Particle { constructor() { this.active = false; } init(x, y, c) { this.active = true; this.x = x; this.y = y; this.color = c; this.life = 0.5+Math.random()*0.5; const a = Math.random()*6.28, s = Math.random()*200+50; this.vx = Math.cos(a)*s; this.vy = Math.sin(a)*s; } update(dt) { if(!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.95; this.vy*=0.95; this.life-=dt; if(this.life<=0) particlePool.release(this); } }
export class DamageText { constructor() { this.active = false; } init(a, x, y) { this.active = true; this.x = x; this.y = y; this.text = typeof a==='number'?Math.floor(a):a; this.life = 0.8; this.vx = (Math.random()-0.5)*20; } update(dt) { if(!this.active) return; this.y-=50*dt; this.x+=this.vx*dt; this.life-=dt; if(this.life<=0) damageTextPool.release(this); } }

// POOLS
export const player = new Player();
export const enemyPool = new ObjectPool(() => new Enemy(), 200);
export const projectilePool = new ObjectPool(() => new Projectile(), 100);
export const gemPool = new ObjectPool(() => new Gem(), 200);
export const particlePool = new ObjectPool(() => new Particle(), 200);
export const damageTextPool = new ObjectPool(() => new DamageText(), 50);

export function spawnGem(x,y,v,d) { gemPool.get().init(x,y,v,d); }
export function spawnParticle(x,y,c) { particlePool.get().init(x,y,c); }
export function spawnDamageText(a,x,y) { damageTextPool.get().init(a,x,y); }

// WEAPON LOGIC
function fireWeaponLogic(p, w) {
    let nearest = null, minDist = Infinity;
    for (const e of enemyPool.active) {
        const dx = (e.x + e.width/2) - (p.x + p.width/2);
        const dy = (e.y + e.height/2) - (p.y + p.height/2);
        const d = dx*dx + dy*dy;
        if (d < minDist) { minDist = d; nearest = e; }
    }

    const pCx = p.x + p.width/2;
    const pCy = p.y + p.height/2;
    const dmg = w.damage * p.damageMult;
    const count = w.projectiles || 1;

    if (w.type === 'NEON_WAND') {
        if (nearest && minDist < 400*400) {
            for(let i=0; i<count; i++) {
                const spread = (i - (count-1)/2) * 20;
                projectilePool.get().init('NEON_WAND', pCx, pCy, nearest.x + nearest.width/2 + spread, nearest.y + nearest.height/2 + spread, dmg);
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
                const a = Math.random() * 6.28;
                tx = pCx + Math.cos(a)*150; ty = pCy + Math.sin(a)*150;
            }
            projectilePool.get().init('GLITCH_BOMB', pCx, pCy, tx, ty, dmg);
        }
        w.cooldown = w.fireRate * p.fireRateMult;
    } else if (w.type === 'PIXEL_RAIL') {
        if (nearest) {
            projectilePool.get().init('PIXEL_RAIL', pCx, pCy, nearest.x + nearest.width/2, nearest.y + nearest.height/2, dmg);
            w.cooldown = w.fireRate * p.fireRateMult;
        }
    } else if (w.type === 'VOID_AXE') {
        let tx = pCx + 100, ty = pCy;
        if (nearest) { tx = nearest.x + nearest.width/2; ty = nearest.y + nearest.height/2; }
        projectilePool.get().init('VOID_AXE', pCx, pCy, tx, ty, dmg);
        w.cooldown = w.fireRate * p.fireRateMult;
    } else if (w.type === 'FORCE_FIELD') {
        createExplosion(pCx, pCy, dmg);
        w.cooldown = w.fireRate * p.fireRateMult;
    }
}

export function createExplosion(x, y, damage) {
    sceneManager.addShake(15);
    const range = 100;
    for (const e of enemyPool.active) {
        const dx = e.x - x, dy = e.y - y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < range) e.takeDamage(damage, 300, x, y);
    }
    const pCount = GameData.settings.particles === 'High' ? 20 : 5;
    for(let i=0; i<pCount; i++) spawnParticle(x, y, '#ff0');
}
