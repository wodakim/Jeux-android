import { GameData } from './utils.js';
import { UI } from './ui.js';
import { audioController } from './audio.js';
import { player, enemyPool, projectilePool, gemPool, particlePool, damageTextPool, spawnGem, spawnParticle, spawnDamageText, createExplosion } from './entities.js';
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
        this.setupTouch();
        this.setupKeyboard();
    }

    setupTouch() {
        document.addEventListener('touchstart', (e) => {
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
    endGame() { endGameLogic(); },
    triggerLevelUpScreen() { triggerLevelUpScreenLogic(); }
};

// Resize
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// Game Loop
export function startGame() {
    score = 0; gameTime = 0; spawnTimer = 0; waveTimer = 0;
    bossSpawned = false; nemesisSpawned = false; corruptionLevel = 0;

    player.reset(selectedCharacter);
    enemyPool.reset(); projectilePool.reset(); gemPool.reset(); particlePool.reset(); damageTextPool.reset();

    sceneManager.changeScene('PLAYING');
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
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
        { id: 'PIXEL_RAIL', title: 'Pixel Rail', desc: 'New Weapon' },
        { id: 'VOID_AXE', title: 'Void Axe', desc: 'New Weapon' },
        { id: 'FORCE_FIELD', title: 'Force Field', desc: 'New Weapon' },
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

function updateGame(dt) {
    gameTime += dt; spawnTimer += dt; waveTimer += dt;
    const diffMult = 1.0 + (corruptionLevel * 0.1);
    const spawnRate = Math.max(0.2, (1.5 - (gameTime / 60) * 0.1) / diffMult);

    if (!bossSpawned && gameTime > 120) {
        bossSpawned = true;
        spawnDamageText("WARNING: WARDEN DETECTED", player.x, player.y - 100);
        sceneManager.addShake(30);
        const a = Math.random() * 6.28;
        enemyPool.get().init('WARDEN', player.x + Math.cos(a)*400, player.y + Math.sin(a)*400);
    }

    if (spawnTimer > spawnRate && !bossSpawned) {
        spawnTimer = 0;
        const a = Math.random() * 6.28;
        const r = Math.sqrt(canvas.width**2 + canvas.height**2)/2 + 150;
        const sx = player.x + Math.cos(a)*r, sy = player.y + Math.sin(a)*r;
        const rand = Math.random();
        let type = 'SWARMER';
        if (rand > 0.95) {
            for(let i=0; i<3; i++) {
                const off = (i/3)*6.28;
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

    player.update(dt, input);
    enemyPool.active.forEach(e => e.update(dt));
    projectilePool.active.forEach(p => p.update(dt));
    gemPool.active.forEach(g => {
        const d = Math.sqrt((player.x-g.x)**2+(player.y-g.y)**2);
        if (d < 100) { g.x+=(player.x-g.x)/d*300*dt; g.y+=(player.y-g.y)/d*300*dt; }
    });
    particlePool.active.forEach(p => p.update(dt));
    damageTextPool.active.forEach(t => t.update(dt));

    // Collisions
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
                    if (p.type === 'NEON_WAND') { e.takeDamage(p.damage, 100, p.x, p.y); projectilePool.release(p); break; }
                    else if (p.type === 'GLITCH_BOMB') { createExplosion(p.x, p.y, p.damage); projectilePool.release(p); break; }
                    else if (p.type === 'PIXEL_RAIL') e.takeDamage(p.damage, 50, p.x, p.y);
                    else if (p.type === 'VOID_AXE') e.takeDamage(p.damage, 200, p.x, p.y);
                    else if (p.type === 'FORCE_FIELD') e.takeDamage(p.damage, 300, p.x, p.y);
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

    if (shakeIntensity > 0) {
        const dx = (Math.random()-0.5)*shakeIntensity*2;
        const dy = (Math.random()-0.5)*shakeIntensity*2;
        ctx.translate(dx, dy);
        shakeIntensity *= 0.9;
    }

    ctx.save();
    let cx = canvas.width/2 - player.x - player.width/2;
    let cy = canvas.height/2 - player.y - player.height/2;
    cx = Math.min(0, Math.max(cx, canvas.width - WORLD_WIDTH));
    cy = Math.min(0, Math.max(cy, canvas.height - WORLD_HEIGHT));

    // Draw Grid
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath();
    const gs = 50;
    const sx = -(cx % gs), sy = -(cy % gs);
    for (let x = sx; x < canvas.width; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
    for (let y = sy; y < canvas.height; y += gs) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
    ctx.stroke();

    ctx.translate(cx, cy);

    // World Border
    ctx.strokeStyle = '#f00'; ctx.lineWidth = 5; ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Entities
    const all = [
        { y: player.y + player.height, d: () => {
            ctx.shadowBlur = 15; ctx.shadowColor = player.color; ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.width, player.height);
            ctx.shadowBlur = 0; ctx.fillStyle = '#0aa';
            ctx.fillRect(player.x+player.width, player.y+4, 4, player.height);
            ctx.fillRect(player.x+4, player.y+player.height, player.width, 4);
        }},
        ...enemyPool.active.map(e => ({ y: e.y + e.height, d: () => {
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
        }}))
    ].sort((a,b) => a.y - b.y);
    all.forEach(x => x.d());

    projectilePool.active.forEach(p => {
        ctx.fillStyle = p.type==='GLITCH_BOMB'?'#f0f':'#fff';
        if (p.type==='GLITCH_BOMB') { ctx.beginPath(); ctx.arc(p.x+p.width/2, p.y+p.height/2, p.width/2, 0, 6.28); ctx.fill(); }
        else ctx.fillRect(p.x, p.y, p.width, p.height);
    });
    particlePool.active.forEach(p => { ctx.fillStyle=p.color; ctx.globalAlpha=p.life*2; ctx.fillRect(p.x, p.y, 4, 4); ctx.globalAlpha=1; });
    damageTextPool.active.forEach(t => { ctx.fillStyle='#fff'; ctx.font='30px VT323'; ctx.fillText(t.text, t.x, t.y); });

    ctx.restore();

    // HUD
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '24px VT323';
    ctx.fillText(`SCORE: ${score}`, 20, 40);
    ctx.fillText(`TIME: ${Math.floor(gameTime/60)}:${(Math.floor(gameTime%60)+"").padStart(2,'0')}`, 20, 70);

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
        const kx = input.joystick.originX + input.joystick.x*size;
        const ky = input.joystick.originY + input.joystick.y*size;
        ctx.fillStyle='rgba(0,255,255,0.8)'; ctx.beginPath(); ctx.arc(kx, ky, 25, 0, 6.28); ctx.fill();
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
        ctx.fillStyle = '#0ff'; ctx.font = '30px VT323'; ctx.textAlign = 'center'; ctx.fillText('LOADING LOOMIVERS...', canvas.width/2, canvas.height/2);
        if (sceneManager.bootTimer > 2) sceneManager.changeScene('TITLE');
    } else if (currentScene === 'TITLE') {
        ctx.fillStyle = '#0ff'; ctx.font = '80px VT323'; ctx.textAlign = 'center'; ctx.fillText('LOOMIVERS', canvas.width/2, 100);
        ctx.fillStyle = '#fff'; ctx.font = '30px VT323'; ctx.fillText("THE WEAVER'S GLITCH", canvas.width/2, 140);
        UI.drawButton(ctx, 'PLAY', canvas.width/2-100, 220, 200, 50, '#0a0', () => sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'HUB') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#0ff'; ctx.textAlign='center'; ctx.fillText("THE SANCTUARY", canvas.width/2, 50);

        const cx = canvas.width/2 - 100;
        UI.drawButton(ctx, 'ENTER GLITCH', cx, 120, 200, 50, '#0a0', () => startGame());
        UI.drawButton(ctx, 'CHARACTERS', cx, 190, 200, 50, '#f0f', () => sceneManager.changeScene('WARDROBE'));
        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', () => sceneManager.changeScene('TITLE'));

        UI.handleInput(input);
    } else if (currentScene === 'WARDROBE') {
        ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("CHARACTER SELECT", canvas.width/2, 50);
        let y=100;
        Object.keys(CHARACTERS).forEach(k => {
            const c=CHARACTERS[k], u=GameData.progress.unlockedChars.includes(k), s=selectedCharacter===k;
            ctx.fillStyle=c.color; ctx.fillRect(canvas.width/2-200,y,50,50);
            ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.font='28px VT323'; ctx.fillText(c.name+(s?" (READY)":""), canvas.width/2-130, y+35);
            if(u){ if(!s) UI.drawButton(ctx, 'SELECT', canvas.width/2+150, y, 100, 50, '#00a', ()=>selectedCharacter=k); }
            else if(GameData.progress.currency>=c.price) UI.drawButton(ctx, `BUY ${c.price}`, canvas.width/2+150, y, 100, 50, '#0a0', ()=>{GameData.progress.currency-=c.price; GameData.progress.unlockedChars.push(k); GameData.saveProgress();});
            else { ctx.fillStyle='#333'; ctx.fillRect(canvas.width/2+150,y,100,50); ctx.fillStyle='#555'; ctx.fillText("LOCKED", canvas.width/2+160, y+30); }
            y+=70;
        });
        UI.drawButton(ctx, 'BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput(input);
    } else if (currentScene === 'PLAYING') {
        updateGame(dt); render();
    } else if (currentScene === 'LEVEL_UP') {
        render(); ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        let y=180;
        activeUpgradeChoices.forEach(c => {
            UI.drawButton(ctx, "", canvas.width/2-200, y, 400, 80, '#222', ()=>selectUpgrade(c.id));
            ctx.textAlign='left'; ctx.fillStyle='#0ff'; ctx.fillText(c.title, canvas.width/2-180, y+30);
            ctx.fillStyle='#ccc'; ctx.fillText(c.desc, canvas.width/2-180, y+60);
            y+=100;
        });
        UI.handleInput(input);
    } else if (currentScene === 'GAME_OVER') {
        render(); ctx.fillStyle='rgba(50,0,0,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.textAlign='center'; ctx.fillStyle='#f00'; ctx.fillText("GAME OVER", canvas.width/2, canvas.height/3);
        UI.drawButton(ctx, 'RETRY', canvas.width/2-100, canvas.height/2+60, 200, 60, '#fff', ()=>startGame());
        UI.handleInput(input);
    }

    input.clearTaps();
    requestAnimationFrame(gameLoop);
}

GameData.load();
const resumeAudio = () => { if(audioController.audioCtx && audioController.audioCtx.state === 'suspended') audioController.audioCtx.resume(); audioController.init(); };
window.addEventListener('touchstart', resumeAudio, {once:true});
window.addEventListener('click', resumeAudio, {once:true});

lastTime = performance.now();
requestAnimationFrame(gameLoop);
