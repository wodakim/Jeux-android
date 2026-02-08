import { ObjectPool, checkRectCollide } from './utils.js';
import { GameData, audioController } from './state.js';
import { sceneManager } from './main.js'; // Will be defined later, used for endless mode trigger

// We need a reference to the Player for tracking/scaling, but player.js imports entities.js.
// Circular dependency. Best to pass player as arg to update(), or use a global game context.
// I will pass 'context' object { player, score, etc } to updates.

export class Projectile {
    constructor() { this.active = false; }
    init(type, x, y, tx, ty, dmg, isEnemy=false) {
        this.active = true; this.type = type; this.x = x; this.y = y; this.damage = dmg; this.isEnemy = isEnemy;
        this.duration = 3; this.vx = 0; this.vy = 0; this.width = 10; this.height = 10;

        if(['NEON_WAND','BOSS_ORB','CYBER_SHURIKEN','DICE_BOMB'].includes(type)) {
            const speed = type==='BOSS_ORB'?150 : type==='CYBER_SHURIKEN'?300 : type==='DICE_BOMB'?250 : 400;
            const dx = tx - x, dy = ty - y;
            const d = Math.sqrt(dx*dx + dy*dy) || 1;
            this.vx = (dx/d)*speed; this.vy = (dy/d)*speed;
            this.width = 8; this.height = 8;
            if(type==='CYBER_SHURIKEN') this.bounces = 3;
        } else if(type === 'GLITCH_BOMB') {
            const dx = tx - x, dy = ty - y;
            const d = Math.sqrt(dx*dx + dy*dy) || 1;
            this.vx = (dx/d)*200; this.vy = (dy/d)*200;
            this.width = 16; this.height = 16;
        } else if(type === 'PIXEL_RAIL') {
            this.duration = 0.2; this.tx = tx; this.ty = ty;
        } else if(type === 'REALITY_TEAR' || type === 'CORRUPT_CLOUD') {
            this.duration = 5; this.width = 40; this.height = 40;
        } else if(type === 'VOID_AXE') {
            this.duration = 0.3; this.vx = (tx-x); this.vy = (ty-y); this.width = 60; this.height = 60;
        } else if(type === 'AUTO_TURRET') {
            this.duration = 10; this.fireTimer = 0; this.width = 20; this.height = 20;
        }
    }

    update(dt, gameCtx) {
        if(!this.active) return;

        if(this.type === 'AUTO_TURRET') {
            this.fireTimer += dt;
            if(this.fireTimer > 1.0) {
                this.fireTimer = 0;
                let near = null, minDist = 99999;
                for(const e of enemyPool.active) {
                    const d = (e.x-this.x)**2 + (e.y-this.y)**2;
                    if(d<minDist) { minDist=d; near=e; }
                }
                if(near) projectilePool.get().init('NEON_WAND', this.x, this.y, near.x, near.y, this.damage);
            }
        } else if (this.type === 'CYBER_SHURIKEN') {
            this.x += this.vx * dt; this.y += this.vy * dt;
            if(this.x < 0 || this.x > window.innerWidth) { this.vx *= -1; this.bounces--; } // Using window.innerWidth as canvas size proxy
            if(this.y < 0 || this.y > window.innerHeight) { this.vy *= -1; this.bounces--; }
            if(this.bounces < 0) this.duration = 0;
        } else if (!['REALITY_TEAR','CORRUPT_CLOUD','PIXEL_RAIL','VOID_AXE'].includes(this.type)) {
            this.x += this.vx * dt; this.y += this.vy * dt;
        }

        this.duration -= dt;
        if(this.duration <= 0) projectilePool.release(this);
    }
}

export class Enemy {
    constructor() { this.active = false; }
    init(type, x, y, level, endless) {
        this.active = true; this.type = type; this.x = x; this.y = y;
        this.flashTimer = 0; this.knockbackX = 0; this.knockbackY = 0; this.attackTimer = 0;

        if (type === 'SWARMER') { this.width = 15; this.height = 15; this.hp = 10 + level*2; this.speed = 80; this.color = '#f00'; }
        else if (type === 'TANK') { this.width = 30; this.height = 30; this.hp = 50 + level*10; this.speed = 40; this.color = '#900'; }
        else if (type === 'GLITCH_MITE') { this.width = 12; this.height = 12; this.hp = 5 + level; this.speed = 120; this.color = '#ff0'; }
        else if (type === 'WARDEN') { this.width = 60; this.height = 60; this.hp = 5000 + level*100; this.maxHp = this.hp; this.speed = 60; this.color = '#f0f'; }

        if(endless) { this.hp *= 1.5; this.speed *= 1.5; }
    }

    update(dt, gameCtx) {
        if(!this.active) return;
        if(this.flashTimer > 0) this.flashTimer -= dt;

        if(Math.abs(this.knockbackX) > 1 || Math.abs(this.knockbackY) > 1) {
            this.x += this.knockbackX*dt; this.y += this.knockbackY*dt;
            this.knockbackX *= 0.9; this.knockbackY *= 0.9;
        } else {
            // Separation
            let sepX = 0, sepY = 0;
            if(this.type !== 'WARDEN') {
                let checks = 0;
                for(const o of enemyPool.active) {
                    if(checks>10) break;
                    if(o === this || o.type === 'WARDEN') continue;
                    const dx = this.x - o.x, dy = this.y - o.y;
                    if(Math.abs(dx)>30 || Math.abs(dy)>30) continue;
                    const d2 = dx*dx + dy*dy;
                    if(d2 < 900 && d2 > 0) {
                        const d = Math.sqrt(d2);
                        sepX += (dx/d) * ((30-d)/30) * 100;
                        sepY += (dy/d) * ((30-d)/30) * 100;
                        checks++;
                    }
                }
            }
            // Chase
            const dx = gameCtx.player.x - this.x, dy = gameCtx.player.y - this.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if(d>0) {
                this.x += (dx/d * this.speed + sepX) * dt;
                this.y += (dy/d * this.speed + sepY) * dt;
            }

            // Boss Logic
            if(this.type === 'WARDEN') {
                this.attackTimer += dt;
                const rate = this.hp < this.maxHp*0.5 ? 1.0 : 2.0;
                if(this.attackTimer > rate) {
                    this.attackTimer = 0;
                    for(let i=-1; i<=1; i++) projectilePool.get().init('BOSS_ORB', this.x+this.width/2, this.y+this.height/2, gameCtx.player.x + i*50, gameCtx.player.y + i*50, 20, true);
                    audioController.playCrunch();
                }
            } else if (this.type === 'TANK') {
                if(Math.random() < 0.05) spawnParticle(this.x+this.width/2, this.y+this.height/2, '#500');
            }
        }
    }

    takeDamage(amt, kb=0, sx=0, sy=0, gameCtx) {
        this.hp -= amt; this.flashTimer = 0.1;
        if(kb > 0) {
            const dx = this.x - sx, dy = this.y - sy;
            const d = Math.sqrt(dx*dx + dy*dy) || 1;
            this.knockbackX = (dx/d) * kb; this.knockbackY = (dy/d) * kb;
        }
        spawnDamageText(amt, this.x, this.y);
        if(this.hp <= 0) this.die(gameCtx);
    }

    die(gameCtx) {
        this.active = false; audioController.playCrunch(); enemyPool.release(this);

        // Loot
        if(Math.random() < 0.1) spawnGem(this.x, this.y, 10, true);
        else spawnGem(this.x, this.y, this.type==='TANK'?5:1, false);

        if(gameCtx.player.glitchMeter < gameCtx.player.glitchMax) gameCtx.player.glitchMeter++;
        for(let i=0;i<3;i++) spawnParticle(this.x, this.y, this.color);

        gameCtx.addScore(this.type==='TANK'?50:10);

        if(this.type === 'WARDEN') {
            gameCtx.setEndlessMode(true);
            spawnDamageText("REALITY FRACTURED!", gameCtx.player.x, gameCtx.player.y - 50);
            spawnDamageText("ENDLESS MODE ENGAGED", gameCtx.player.x, gameCtx.player.y);
            gameCtx.addShake(50);
        }

        if(this.isNemesis) {
            gameCtx.player.gainXp(100);
            GameData.progress.nemesis = null;
            GameData.saveProgress();
            spawnDamageText("NEMESIS DEFEATED!", this.x, this.y - 30);
        }
    }
}

export class Gem { constructor() { this.active = false; } init(x, y, v, d) { this.active = true; this.x = x; this.y = y; this.val = v; this.isData = d; this.width = d?12:8; this.height = d?12:8; } }
export class Particle { constructor() { this.active = false; } init(x, y, c) { this.active = true; this.x = x; this.y = y; this.c = c; this.life = 0.5+Math.random()*0.5; const a = Math.random()*6.28, s = Math.random()*200+50; this.vx = Math.cos(a)*s; this.vy = Math.sin(a)*s; } update(dt) { if(!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx*=0.95; this.vy*=0.95; this.life-=dt; if(this.life<=0) particlePool.release(this); } }
export class DamageText { constructor() { this.active = false; } init(amt, x, y) { this.active = true; this.x = x; this.y = y; this.txt = typeof amt==='number'?Math.floor(amt):amt; this.life = 0.8; } update(dt) { if(!this.active) return; this.y-=50*dt; this.life-=dt; if(this.life<=0) damageTextPool.release(this); } }

export const projectilePool = new ObjectPool(() => new Projectile(), 200);
export const enemyPool = new ObjectPool(() => new Enemy(), 200);
export const gemPool = new ObjectPool(() => new Gem(), 200);
export const particlePool = new ObjectPool(() => new Particle(), 200);
export const damageTextPool = new ObjectPool(() => new DamageText(), 50);

export function spawnGem(x,y,v,d) { gemPool.get().init(x,y,v,d); }
export function spawnParticle(x,y,c) { particlePool.get().init(x,y,c); }
export function spawnDamageText(a,x,y) { damageTextPool.get().init(a,x,y); }
