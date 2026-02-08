import { CHARACTERS } from './constants.js';
import { GameData, audioController } from './state.js';
import { projectilePool, spawnParticle, enemyPool } from './entities.js';
import { sceneManager } from './main.js'; // For Game Over

// Global fire function to avoid circular dep inside Player methods if possible,
// but Player needs to spawn projectiles. We imported projectilePool, so we can do it here.

export class Player {
    constructor(canvasWidth, canvasHeight) {
        this.x = 0;
        this.y = 0;
        this.width = 20;
        this.height = 20;
        this.canvasW = canvasWidth;
        this.canvasH = canvasHeight;

        this.speed = 200;
        this.hp = 100;
        this.maxHp = 100;
        this.xp = 0;
        this.nextLevelXp = 10;
        this.level = 1;

        this.weapons = [];
        this.iframeTimer = 0;
        this.color = '#0ff';
        this.damageMult = 1.0;
        this.fireRateMult = 1.0;

        this.glitchMeter = 0;
        this.glitchMax = 100;
        this.overdriveActive = false;
        this.overdriveTimer = 0;
    }

    init(charType) {
        const config = CHARACTERS[charType] || CHARACTERS.WEAVER;
        this.reset();
        this.color = config.color;
        this.addWeapon(config.weapon);

        // Passives
        if(charType === 'ARCHITECT') this.maxHp += 20;
        if(charType === 'TANK') { this.maxHp += 50; this.speed -= 20; }
        if(charType === 'SNIPER') this.damageMult += 0.2;
        if(charType === 'NINJA') this.speed += 40;
        if(charType === 'BERSERKER') { this.damageMult += 0.5; this.maxHp += 30; }

        this.hp = this.maxHp;
    }

    reset() {
        this.maxHp = 100 + (GameData.progress.upgrades.health * 10);
        this.damageMult = 1.0 + (GameData.progress.upgrades.damage * 0.05);

        this.x = this.canvasW / 2;
        this.y = this.canvasH / 2;
        this.hp = this.maxHp;
        this.speed = 200;
        this.xp = 0;
        this.nextLevelXp = 10;
        this.level = 1;
        this.iframeTimer = 0;
        this.weapons = [];
        this.fireRateMult = 1.0;
        this.glitchMeter = 0;
        this.overdriveActive = false;
    }

    activateOverdrive(gameCtx) {
        if(this.glitchMeter >= this.glitchMax && !this.overdriveActive) {
            this.overdriveActive = true;
            this.overdriveTimer = 5.0;
            this.glitchMeter = 0;
            gameCtx.addShake(20);
        }
    }

    addWeapon(type) {
        const w = { type, cooldown: 0, level: 1 };
        if (type === 'NEON_WAND') { w.fireRate = 0.5; w.damage = 10; }
        else if (type === 'DATA_ORBIT') { w.fireRate = 0; w.damage = 5; w.angle = 0; }
        else if (type === 'GLITCH_BOMB') { w.fireRate = 2.0; w.damage = 30; }
        else if (type === 'REALITY_TEAR') { w.fireRate = 3.0; w.damage = 50; }
        else if (type === 'FORCE_FIELD') { w.fireRate = 1.5; w.damage = 10; w.pushback = 200; }
        else if (type === 'PIXEL_RAIL') { w.fireRate = 1.5; w.damage = 25; }
        else if (type === 'CORRUPT_CLOUD') { w.fireRate = 0.5; w.damage = 5; }
        else if (type === 'AUTO_TURRET') { w.fireRate = 5.0; w.damage = 10; }
        else if (type === 'CYBER_SHURIKEN') { w.fireRate = 0.8; w.damage = 15; }
        else if (type === 'VOID_AXE') { w.fireRate = 1.0; w.damage = 40; }
        else if (type === 'DICE_BOMB') { w.fireRate = 1.5; w.damage = 0; }
        this.weapons.push(w);
    }

    update(dt, inputVec, gameCtx) {
        // Overdrive
        let sMult = 1.0, fMult = 1.0;
        if(this.overdriveActive) {
            this.overdriveTimer -= dt;
            sMult = 2.0; fMult = 2.0; this.iframeTimer = 0.1;
            if(this.overdriveTimer <= 0) {
                this.overdriveActive = false;
                gameCtx.corruptionLevel++;
            }
        }

        // Move
        this.x += inputVec.x * this.speed * sMult * dt;
        this.y += inputVec.y * this.speed * sMult * dt;

        // Boundaries
        this.x = Math.max(0, Math.min(this.canvasW - this.width, this.x));
        this.y = Math.max(0, Math.min(this.canvasH - this.height, this.y));

        if(this.iframeTimer > 0) this.iframeTimer -= dt;

        // Weapons
        this.weapons.forEach(w => {
            if (w.type === 'DATA_ORBIT') {
                w.angle += 3 * dt * fMult;
            } else {
                w.cooldown -= dt * fMult;
                if (w.cooldown <= 0) {
                    this.fireWeapon(w, gameCtx);
                }
            }
        });
    }

    fireWeapon(w, gameCtx) {
        // We need near enemy
        let near = null, min = 99999;
        const pCx = this.x + this.width/2;
        const pCy = this.y + this.height/2;

        for(const e of enemyPool.active) {
            const eCx = e.x + e.width/2;
            const eCy = e.y + e.height/2;
            const d = (eCx - pCx)**2 + (eCy - pCy)**2;
            if(d < min) { min = d; near = e; }
        }

        w.cooldown = w.fireRate * this.fireRateMult;
        const dmg = w.damage * this.damageMult;

        // Target center
        let tx = 0, ty = 0;
        if(near) {
            tx = near.x + near.width/2;
            ty = near.y + near.height/2;
        }

        if(w.type === 'NEON_WAND' && near) projectilePool.get().init('NEON_WAND', pCx, pCy, tx, ty, dmg);
        else if(w.type === 'GLITCH_BOMB') {
            const gtx = near ? tx : pCx + Math.cos(Math.random()*6.28)*150;
            const gty = near ? ty : pCy + Math.sin(Math.random()*6.28)*150;
            projectilePool.get().init('GLITCH_BOMB', pCx, pCy, gtx, gty, dmg);
        }
        else if(w.type === 'REALITY_TEAR') {
            const rx = pCx + (Math.random()-0.5)*300;
            const ry = pCy + (Math.random()-0.5)*300;
            projectilePool.get().init('REALITY_TEAR', rx, ry, 0, 0, dmg);
        }
        else if(w.type === 'FORCE_FIELD') {
            if(gameCtx.createExplosion) gameCtx.createExplosion(pCx, pCy, dmg, w.pushback);
        }
        else if(w.type === 'PIXEL_RAIL' && near) {
            const angle = Math.atan2(ty - pCy, tx - pCx);
            const ex = pCx + Math.cos(angle) * 1000;
            const ey = pCy + Math.sin(angle) * 1000;
            projectilePool.get().init('PIXEL_RAIL', pCx, pCy, ex, ey, dmg);
        }
        else if(w.type === 'CORRUPT_CLOUD') {
            projectilePool.get().init('CORRUPT_CLOUD', pCx, pCy, 0, 0, dmg);
        }
        else if(w.type === 'AUTO_TURRET') {
            projectilePool.get().init('AUTO_TURRET', pCx, pCy, 0, 0, dmg);
        }
        else if(w.type === 'CYBER_SHURIKEN' && near) {
            projectilePool.get().init('CYBER_SHURIKEN', pCx, pCy, tx, ty, dmg);
        }
        else if(w.type === 'VOID_AXE') {
            const atx = near ? tx : pCx + 100;
            const aty = near ? ty : pCy;
            projectilePool.get().init('VOID_AXE', pCx, pCy, atx, aty, dmg);
        }
        else if(w.type === 'DICE_BOMB' && near) {
            const roll = Math.floor(Math.random()*100)+1;
            projectilePool.get().init('DICE_BOMB', pCx, pCy, tx, ty, roll);
        }
    }

    takeDamage(amt) {
        if(this.iframeTimer > 0) return;
        this.hp -= amt;
        this.iframeTimer = 0.5;
        if(this.hp <= 0) {
            // FIX: Call global/imported scene manager
            sceneManager.gameOver();
        }
    }

    gainXp(amt) {
        this.xp += amt;
        audioController.playPing();
        if(this.xp >= this.nextLevelXp) {
            this.xp -= this.nextLevelXp;
            this.level++;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
            audioController.playLevelUp();
            sceneManager.triggerLevelUp();
        }
    }
}
