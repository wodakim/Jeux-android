import { GameData, audioController } from './state.js';
import { Player } from './player.js';
import { enemyPool, projectilePool, gemPool, particlePool, damageTextPool, spawnGem, spawnParticle, spawnDamageText } from './entities.js';
import { CHARACTERS, UPGRADES, WEAPON_TYPES } from './constants.js';
import { checkRectCollide } from './utils.js';

// --- MAIN SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

GameData.load(); // Load persistence

// Audio Initialization on Interaction
const initAudio = () => {
    audioController.init();
    window.removeEventListener('click', initAudio);
    window.removeEventListener('touchstart', initAudio);
    window.removeEventListener('keydown', initAudio);
};
window.addEventListener('click', initAudio);
window.addEventListener('touchstart', initAudio);
window.addEventListener('keydown', initAudio);

let currentScene = 'BOOT';
let lastTime = 0;
let score = 0;
let gameTime = 0;
let spawnTimer = 0;
let waveTimer = 0;
let corruptionLevel = 0;
let bossSpawned = false;
let nemesisSpawned = false;
let endlessMode = false;
let shakeIntensity = 0;
let animBeat = false;
let animTimer = 0;

// Resize
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// --- INPUT ---
class InputHandler {
    constructor() {
        this.joystick = { x: 0, y: 0, active: false, originX: 0, originY: 0 };
        this.keys = {}; this.taps = [];
        this.setupTouch(); this.setupKeys();
    }
    setupTouch() {
        document.addEventListener('touchstart', e => {
            const t = e.changedTouches[0];
            if(currentScene !== 'PLAYING') { this.taps.push({x:t.clientX, y:t.clientY}); return; }
            const side = GameData.settings.joystickSide;
            const w = window.innerWidth;
            if((side==='Left' && t.clientX < w/2) || (side==='Right' && t.clientX > w/2)) {
                this.joystick.active = true; this.joystick.originX = t.clientX; this.joystick.originY = t.clientY;
                this.joystick.x = 0; this.joystick.y = 0;
            }
            this.taps.push({x:t.clientX, y:t.clientY});
        }, {passive:false});
        document.addEventListener('touchmove', e => {
            if(!this.joystick.active) return;
            e.preventDefault();
            const t = e.changedTouches[0];
            const dx = t.clientX - this.joystick.originX, dy = t.clientY - this.joystick.originY;
            const d = Math.sqrt(dx*dx+dy*dy);
            let size = 50; if(GameData.settings.joystickSize==='Small') size=30; if(GameData.settings.joystickSize==='Large') size=70;
            if(d>0) {
                const a = Math.atan2(dy, dx);
                const c = Math.min(d, size);
                this.joystick.x = (Math.cos(a)*c)/size; this.joystick.y = (Math.sin(a)*c)/size;
            }
        }, {passive:false});
        document.addEventListener('touchend', () => { this.joystick.active = false; this.joystick.x=0; this.joystick.y=0; });
        document.addEventListener('mousedown', e => this.taps.push({x:e.clientX, y:e.clientY}));
    }
    setupKeys() { window.addEventListener('keydown', e=>this.keys[e.code]=true); window.addEventListener('keyup', e=>this.keys[e.code]=false); }
    getMovement() {
        let dx=0, dy=0;
        if(this.keys['ArrowUp']||this.keys['KeyW']) dy-=1;
        if(this.keys['ArrowDown']||this.keys['KeyS']) dy+=1;
        if(this.keys['ArrowLeft']||this.keys['KeyA']) dx-=1;
        if(this.keys['ArrowRight']||this.keys['KeyD']) dx+=1;
        if(dx||dy) { const l = Math.sqrt(dx*dx+dy*dy); return {x:dx/l, y:dy/l}; }
        return {x:this.joystick.x, y:this.joystick.y};
    }
    checkTap(r) { return this.taps.some(t => t.x >= r.x && t.x <= r.x+r.w && t.y >= r.y && t.y <= r.y+r.h); }
    clearTaps() { this.taps = []; }
}
const input = new InputHandler();

// --- UI ---
const UI = {
    buttons: [], sliders: [],
    drawButton(text, x, y, w, h, color, action) {
        ctx.fillStyle = color; ctx.fillRect(x,y,w,h);
        ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
        ctx.fillStyle = '#fff'; ctx.font='24px VT323'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(text, x+w/2, y+h/2);
        this.buttons.push({x,y,w,h,action});
    },
    drawSlider(label, val, x, y, w, h, cb) {
        ctx.fillStyle='#333'; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
        ctx.fillStyle='#0f0'; ctx.fillRect(x,y,w*val,h);
        ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(`${label}: ${Math.round(val*100)}%`, x, y-15);
        this.sliders.push({x,y,w,h,cb});
    },
    drawSelector(label, opts, cur, x, y, w, h, cb) {
        ctx.fillStyle='#fff'; ctx.textAlign='left'; ctx.fillText(label, x, y-15);
        const ow = w/opts.length;
        opts.forEach((o,i) => {
            const ox = x + i*ow;
            const sel = o===cur;
            ctx.fillStyle = sel ? '#0a0':'#333'; ctx.fillRect(ox,y,ow,h); ctx.strokeRect(ox,y,ow,h);
            ctx.fillStyle = sel ? '#fff':'#aaa'; ctx.textAlign='center'; ctx.fillText(o, ox+ow/2, y+h/2);
            this.buttons.push({x:ox, y, w:ow, h, action:()=>cb(o)});
        });
    },
    drawToggle(l, v, x, y, w, h, cb) { this.drawSelector(l, ['OFF','ON'], v?'ON':'OFF', x,y,w,h, val=>cb(val==='ON')); },
    handleInput() {
        this.buttons.forEach(b => { if(input.checkTap(b)) { audioController.playPing(); b.action(); } });
        this.sliders.forEach(s => {
            input.taps.forEach(t => {
                if(t.x>=s.x && t.x<=s.x+s.w && t.y>=s.y && t.y<=s.y+s.h) s.cb(Math.max(0, Math.min(1, (t.x-s.x)/s.w)));
            });
        });
        this.buttons=[]; this.sliders=[];
    }
};

// --- SCENE MANAGER ---
let upgradeChoices = [];
const player = new Player(canvas.width, canvas.height);

export const sceneManager = {
    bootTimer: 0,
    changeScene(name) {
        currentScene = name;
        input.clearTaps();
        if (name === 'PLAYING') audioController.startMusic();
        else audioController.stopMusic();
    },
    gameOver() {
        this.changeScene('GAME_OVER');
        if(score > GameData.progress.highScore) GameData.progress.highScore = score;
        if(enemyPool.active.length > 0) {
            const killer = enemyPool.active[0];
            GameData.progress.nemesis = { type: killer.type, hp: killer.hp, damage: 10, color: killer.color };
        }
        GameData.saveProgress();
    },
    triggerLevelUp() {
        this.changeScene('LEVEL_UP');
        upgradeChoices = [];
        while(upgradeChoices.length<3) {
            const r=Math.random(); let pick;
            if(r<0.3) pick={id:'HEAL', t:'Repair', d:'+50 HP'};
            else if(r<0.6) pick={id:'DMG', t:'Power', d:'+20% Dmg'};
            else {
                const w=WEAPON_TYPES[Math.floor(Math.random()*WEAPON_TYPES.length)];
                const owned = player.weapons.find(pw => pw.type === w);
                pick={id:w, t:w.replace('_',' '), d: owned ? `Upgrade (Lvl ${owned.level+1})` : 'New Weapon'};
            }
            if(!upgradeChoices.find(c=>c.id===pick.id)) upgradeChoices.push(pick);
        }
    }
};

// --- HELPERS ---
function addShake(amt) { shakeIntensity = Math.min(shakeIntensity+amt, 20); }
function createExplosion(x,y,d,p=0){
    addShake(10);
    for(const e of enemyPool.active) {
        if(Math.sqrt((e.x-x)**2+(e.y-y)**2)<100) e.takeDamage(d,p,x,y,gameContext);
    }
    for(let i=0;i<10;i++) spawnParticle(x,y,'#ff0');
}

const gameContext = {
    player,
    addScore: (v) => score += v,
    addShake,
    createExplosion,
    setEndlessMode: (v) => endlessMode = v,
    get corruptionLevel() { return corruptionLevel; },
    set corruptionLevel(v) { corruptionLevel = v; }
};

// --- GAME LOOP ---
function startGame(charType) {
    score=0; gameTime=0; spawnTimer=0; waveTimer=0; bossSpawned=false; nemesisSpawned=false; endlessMode=false;
    player.canvasW = canvas.width; player.canvasH = canvas.height;
    player.init(charType);
    enemyPool.reset(); projectilePool.reset(); gemPool.reset(); particlePool.reset(); damageTextPool.reset();
    sceneManager.changeScene('PLAYING');
    lastTime=performance.now();
    requestAnimationFrame(gameLoop);
}

function selectUpgrade(id) {
    if(id==='HEAL') player.hp=Math.min(player.maxHp, player.hp+50);
    else if(id==='DMG') player.damageMult*=1.2;
    else {
        const e=player.weapons.find(w=>w.type===id);
        if(e){e.level++; e.damage*=1.2;} else player.addWeapon(id);
    }
    sceneManager.changeScene('PLAYING'); lastTime=performance.now(); requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    gameTime+=dt; spawnTimer+=dt; waveTimer+=dt;
    animTimer += dt;
    if(animTimer > 0.25) { animTimer = 0; animBeat = !animBeat; }

    const diff = 1 + corruptionLevel*0.1 + (endlessMode?0.5:0);
    const rate = Math.max(0.1, (1.5 - gameTime/60 * 0.1)/diff);

    if(!bossSpawned && gameTime>120) { bossSpawned=true; enemyPool.get().init('WARDEN', player.x+400, player.y, player.level, endlessMode); spawnDamageText("WARDEN DETECTED", player.x, player.y-100); }
    if(spawnTimer>rate && (!bossSpawned || endlessMode)) {
        spawnTimer=0; const a=Math.random()*6.28, r=500; const sx=player.x+Math.cos(a)*r, sy=player.y+Math.sin(a)*r;
        let t='SWARMER'; if(Math.random()>0.9) t='GLITCH_MITE'; else if(Math.random()>0.85) t='TANK';
        enemyPool.get().init(t, sx, sy, player.level, endlessMode);
    }

    player.update(dt, input.getMovement(), gameContext);
    enemyPool.active.forEach(e=>e.update(dt, gameContext));
    projectilePool.active.forEach(p=>p.update(dt, gameContext));
    gemPool.active.forEach(g=>{
        const d = Math.sqrt((player.x-g.x)**2+(player.y-g.y)**2);
        if(d<100) { g.x+=(player.x-g.x)/d*300*dt; g.y+=(player.y-g.y)/d*300*dt; }
        if(checkRectCollide(player, g)) { if(g.isData) { GameData.progress.currency+=g.val; spawnDamageText("+$"+g.val, player.x, player.y-20); audioController.playPing(); } else player.gainXp(g.val); gemPool.release(g); }
    });
    particlePool.active.forEach(p=>p.update(dt));
    damageTextPool.active.forEach(t=>t.update(dt));

    if(player.iframeTimer<=0) { for(const e of enemyPool.active) { if(checkRectCollide(player, e)) { player.takeDamage(10); addShake(10); break; } } }

    projectilePool.active.forEach(p => {
        if(p.isEnemy) { if(checkRectCollide(player, p)) { player.takeDamage(p.damage); projectilePool.release(p); } }
        else if(p.type==='PIXEL_RAIL') {}
        else if(['REALITY_TEAR','CORRUPT_CLOUD','VOID_AXE'].includes(p.type)) {
            enemyPool.active.forEach(e => { if(checkRectCollide(p, e) && Math.random()<0.1) e.takeDamage(p.damage, 0, p.x, p.y, gameContext); });
        } else {
            for(const e of enemyPool.active) {
                if(checkRectCollide(p, e)) {
                    if(['GLITCH_BOMB','DICE_BOMB'].includes(p.type)) createExplosion(p.x, p.y, p.damage, 0);
                    else if(p.type==='FORCE_FIELD') {/* Handled via Area */ }
                    else e.takeDamage(p.damage, 100, p.x, p.y, gameContext);

                    if(!p.penetrate) { projectilePool.release(p); break; }
                }
            }
        }
    });

    const orb = player.weapons.find(w=>w.type==='DATA_ORBIT');
    if(orb) {
        const ox=player.x+10+Math.cos(orb.angle)*60, oy=player.y+10+Math.sin(orb.angle)*60;
        enemyPool.active.forEach(e => { if(Math.sqrt((e.x-ox)**2+(e.y-oy)**2)<30 && Math.random()<0.1) e.takeDamage(orb.damage, 10, player.x, player.y, gameContext); });
    }
}

function drawGridBackground(ox=0, oy=0) {
    ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=2; ctx.beginPath();
    const s = 100;
    const gx = ox % s;
    const gy = oy % s;
    for(let x=gx; x<canvas.width; x+=s) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
    for(let y=gy; y<canvas.height; y+=s) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
    ctx.stroke();

    // Minor grid
    ctx.strokeStyle='#0d0d0d'; ctx.lineWidth=1; ctx.beginPath();
    const sm = 25;
    const gmx = ox % sm;
    const gmy = oy % sm;
    for(let x=gmx; x<canvas.width; x+=sm) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
    for(let y=gmy; y<canvas.height; y+=sm) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
    ctx.stroke();
}

function drawEntity(e, c) {
    let dy = 0;
    let h = e.height;
    if(animBeat && e.speed > 0) { // Only animate if moving (speed > 0 check is rough, but effective)
        dy = 2; h -= 2;
    }
    // Base Shadow
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(e.x+4, e.y+e.height-4, e.width, 4);

    // Body
    ctx.fillStyle=c; ctx.fillRect(e.x, e.y+dy, e.width, h);

    // Highlight (pseudo-3D)
    ctx.fillStyle='rgba(255,255,255,0.1)'; ctx.fillRect(e.x, e.y+dy, e.width, h/2);

    // Side/Bottom Shading
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.fillRect(e.x+e.width-4, e.y+dy, 4, h); // Right side
    ctx.fillRect(e.x, e.y+dy+h-4, e.width, 4); // Bottom
}
function drawGem(g) {
    const off = animBeat ? -2 : 0;
    ctx.fillStyle=g.isData?'#0ff':'#ff0';
    ctx.beginPath(); ctx.moveTo(g.x+g.width/2, g.y+off); ctx.lineTo(g.x+g.width, g.y+g.height/2+off); ctx.lineTo(g.x+g.width/2, g.y+g.height+off); ctx.lineTo(g.x, g.y+g.height/2+off); ctx.fill();
}
function drawProjectile(p) {
    ctx.fillStyle='#fff';
    if(p.type==='BOSS_ORB') { ctx.fillStyle='#f00'; ctx.beginPath(); ctx.arc(p.x+p.width/2, p.y+p.height/2, 8, 0, 6.28); ctx.fill(); }
    else if(p.type==='REALITY_TEAR') { ctx.fillStyle='#f0f'; ctx.globalAlpha=0.5; ctx.fillRect(p.x, p.y, p.width, p.height); ctx.globalAlpha=1; }
    else if(p.type==='CORRUPT_CLOUD') { ctx.fillStyle='#0f0'; ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(p.x+p.width/2, p.y+p.height/2, 30, 0, 6.28); ctx.fill(); ctx.globalAlpha=1; }
    else if(p.type==='PIXEL_RAIL') { ctx.strokeStyle='#ff0'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke(); }
    else ctx.fillRect(p.x, p.y, p.width, p.height);
}

function render() {
    ctx.setTransform(1,0,0,1,0,0);

    drawGridBackground(-player.x, -player.y);

    if(shakeIntensity>0) { ctx.translate((Math.random()-.5)*shakeIntensity, (Math.random()-.5)*shakeIntensity); shakeIntensity*=0.9; }

    ctx.save();
    ctx.translate(canvas.width/2 - player.x - player.width/2, canvas.height/2 - player.y - player.height/2);

    const all = [
        {y:player.y+player.height, d:()=>drawEntity(player, player.color)},
        ...enemyPool.active.map(e=>({y:e.y+e.height, d:()=>drawEntity(e, e.flashTimer>0?'#fff':e.color)})),
        ...gemPool.active.map(g=>({y:g.y+g.height, d:()=>drawGem(g)}))
    ].sort((a,b)=>a.y-b.y);
    all.forEach(x=>x.d());

    projectilePool.active.forEach(p=>drawProjectile(p));
    particlePool.active.forEach(p=>{ ctx.fillStyle=p.c; ctx.globalAlpha=p.life*2; ctx.fillRect(p.x,p.y,4,4); ctx.globalAlpha=1; });
    damageTextPool.active.forEach(t=>{ ctx.fillStyle='#fff'; ctx.font='30px VT323'; ctx.fillText(t.txt, t.x, t.y); });

    const o = player.weapons.find(w=>w.type==='DATA_ORBIT');
    if(o) { ctx.fillStyle='#0ff'; ctx.beginPath(); ctx.arc(player.x+10+Math.cos(o.angle)*60, player.y+10+Math.sin(o.angle)*60, 5, 0, 6.28); ctx.fill(); }

    // DEBUG
    if(GameData.settings.debugMode) {
        ctx.strokeStyle='red'; ctx.lineWidth=1;
        [player, ...enemyPool.active, ...projectilePool.active, ...gemPool.active].forEach(e => ctx.strokeRect(e.x, e.y, e.width, e.height));
    }

    ctx.restore();

    ctx.fillStyle='#fff'; ctx.font='24px VT323'; ctx.textAlign='left';
    ctx.fillText(`SCORE: ${score}`, 20, 40);
    ctx.fillText(`TIME: ${Math.floor(gameTime/60)}:${(Math.floor(gameTime%60)+"").padStart(2,'0')}`, 20, 70);

    const bx=(canvas.width-200)/2, by=canvas.height-40;
    ctx.fillStyle='#333'; ctx.fillRect(bx,by,200,20);
    ctx.fillStyle='#0f0'; ctx.fillRect(bx,by,200*(Math.max(0,player.hp)/player.maxHp),20);
    ctx.strokeStyle='#fff'; ctx.strokeRect(bx,by,200,20);

    const boss = enemyPool.active.find(e=>e.type==='WARDEN');
    if(boss) {
        ctx.fillStyle='#300'; ctx.fillRect(20,20,canvas.width-40,30);
        ctx.fillStyle='#f00'; ctx.fillRect(20,20,(canvas.width-40)*(boss.hp/boss.maxHp),30);
        ctx.strokeStyle='#fff'; ctx.strokeRect(20,20,canvas.width-40,30);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("THE WARDEN", canvas.width/2, 42);
    }

    if(player.glitchMeter>=player.glitchMax) UI.drawButton('OVERDRIVE', canvas.width-150, canvas.height-100, 130, 80, '#f0f', ()=>player.activateOverdrive(gameContext));
    else { ctx.fillStyle='#333'; ctx.fillRect(canvas.width-150, canvas.height-40, 130, 20); ctx.fillStyle='#f0f'; ctx.fillRect(canvas.width-150, canvas.height-40, 130*(player.glitchMeter/player.glitchMax), 20); }

    // Pause Button
    UI.drawButton('||', canvas.width-50, 20, 30, 30, '#333', ()=>sceneManager.changeScene('PAUSED'));

    if(GameData.settings.crtEffect) { ctx.fillStyle="rgba(0,0,0,0.1)"; for(let i=0;i<canvas.height;i+=4)ctx.fillRect(0,i,canvas.width,2); }
    UI.handleInput();
}

const introText = [
    "EPISODE V8",
    "THE WEAVER'S GLITCH",
    "",
    "The digital realm of Loomivers is collapsing.",
    "Corrupted data swarms the sectors,",
    "consuming everything in its path.",
    "",
    "You are the last functional Avatar.",
    "Your mission: Survive the purge,",
    "repair the core, and defeat",
    "The Warden of Entropy.",
    "",
    "Prepare for initialization..."
];

function gameLoop(ts) {
    const dt = Math.min((ts - lastTime)/1000, 0.1); lastTime = ts;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

    if(currentScene==='BOOT') {
        sceneManager.bootTimer+=dt;
        const scrollY = canvas.height - (sceneManager.bootTimer * 100);

        ctx.fillStyle='#ff0'; ctx.font='30px VT323'; ctx.textAlign='center';
        introText.forEach((line, i) => {
            const ly = scrollY + i*40;
            if(ly > 0 && ly < canvas.height) ctx.fillText(line, canvas.width/2, ly);
        });

        if(sceneManager.bootTimer > 10 || (input.taps.length > 0 && sceneManager.bootTimer > 1)) {
             sceneManager.changeScene('TITLE');
             input.clearTaps();
        }
    } else if(currentScene==='TITLE') {
        drawGridBackground(0, ts*0.05);
        ctx.fillStyle='#0ff'; ctx.font='80px VT323'; ctx.textAlign='center';
        // Shadow
        ctx.fillStyle='rgba(0,255,255,0.2)'; ctx.fillText("LOOMIVERS", canvas.width/2+4, 104);
        // Main Text
        ctx.fillStyle='#0ff'; ctx.fillText("LOOMIVERS", canvas.width/2, 100);

        ctx.font='30px VT323'; ctx.fillStyle='#fff'; ctx.fillText("THE WEAVER'S GLITCH", canvas.width/2, 140);

        const cx = canvas.width/2 - 100;
        let y = 220;
        UI.drawButton('PLAY', cx, y, 200, 40, '#0a0', ()=>sceneManager.changeScene('HUB')); y+=50;
        UI.drawButton('SETTINGS', cx, y, 200, 40, '#333', ()=>sceneManager.changeScene('SETTINGS')); y+=50;
        UI.drawButton('CREDITS', cx, y, 200, 40, '#333', ()=>alert("Created by Jules")); y+=50;
        UI.drawButton('QUIT', cx, y, 200, 40, '#500', ()=>location.reload());
        UI.handleInput();
    } else if(currentScene==='HUB') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#0ff'; ctx.font='40px VT323'; ctx.textAlign='center'; ctx.fillText('THE SANCTUARY', canvas.width/2, 50);
        ctx.textAlign='left'; ctx.fillStyle='#ff0'; ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, 20, 40);
        const cX=canvas.width/2-100;
        UI.drawButton('ENTER GLITCH', cX, 120, 200, 50, '#f0f', ()=>sceneManager.changeScene('CHARACTER_SELECT'));
        UI.drawButton('BLACKSMITH', cX, 190, 200, 50, '#333', ()=>sceneManager.changeScene('SHOP'));
        UI.drawButton('BACK', 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('TITLE'));
        UI.handleInput();
    } else if(currentScene==='CHARACTER_SELECT') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText("SELECT CHARACTER", canvas.width/2, 50);
        const keys=Object.keys(CHARACTERS); const cols=5; const sx=100, sy=120, gx=150, gy=180;
        keys.forEach((k,i)=>{
            const c=CHARACTERS[k], r=Math.floor(i/cols), col=i%cols, x=sx+col*gx, y=sy+r*gy, un=GameData.progress.unlockedChars.includes(k);
            ctx.fillStyle='#222'; ctx.fillRect(x,y,130,160); ctx.strokeStyle=un?c.color:'#555'; ctx.strokeRect(x,y,130,160);
            ctx.fillStyle=c.color; ctx.fillRect(x+45,y+20,40,40);
            ctx.fillStyle='#fff'; ctx.font='20px VT323'; ctx.fillText(c.name, x+65, y+80);
            ctx.fillStyle='#aaa'; ctx.font='16px VT323'; ctx.fillText(c.stat, x+65, y+100);
            if(un) UI.drawButton("SELECT", x+15, y+120, 100, 30, '#0a0', ()=>startGame(k));
            else if(GameData.progress.currency>=c.price) UI.drawButton(`${c.price}`, x+15, y+120, 100, 30, '#aa0', ()=>{GameData.progress.currency-=c.price; GameData.progress.unlockedChars.push(k); GameData.saveProgress();});
            else { ctx.fillStyle='#500'; ctx.fillText("LOCKED", x+65, y+135); ctx.fillText(c.price, x+65, y+150); }
        });
        UI.drawButton("BACK", 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput();
    } else if(currentScene==='SHOP') {
        ctx.fillStyle='#222'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('THE BLACKSMITH', canvas.width/2, 50);
        ctx.fillStyle='#ff0'; ctx.fillText(`FRAGMENTS: ${GameData.progress.currency}`, canvas.width/2, 80);
        let y=120;
        UPGRADES.forEach(u=>{
            const l=GameData.progress.upgrades[u.id]||0, cost=(l+1)*200;
            ctx.textAlign='left'; ctx.fillStyle='#fff'; ctx.fillText(`${u.name} (LVL ${l})`, canvas.width/2-200, y+25);
            if(GameData.progress.currency>=cost) UI.drawButton(`BUY ${cost}`, canvas.width/2+100, y, 120, 40, '#0a0', ()=>{GameData.progress.currency-=cost; GameData.progress.upgrades[u.id]=(GameData.progress.upgrades[u.id]||0)+1; GameData.saveProgress();});
            else { ctx.fillStyle='#333'; ctx.fillRect(canvas.width/2+100,y,120,40); ctx.fillStyle='#777'; ctx.fillText(cost, canvas.width/2+140, y+25); }
            y+=70;
        });
        UI.drawButton("BACK", 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput();
    } else if(currentScene==='PLAYING') {
        updateGame(dt); render();
    } else if(currentScene==='SETTINGS') {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('SETTINGS', canvas.width/2, 50);
        const cx=canvas.width/2-150; let y=100, g=80;
        UI.drawSlider("MASTER VOLUME", GameData.settings.masterVolume, cx, y, 300, 30, v=>{GameData.settings.masterVolume=v; GameData.saveSettings();}); y+=g;
        UI.drawToggle("CRT EFFECT", GameData.settings.crtEffect, cx, y, 100, 40, v=>{GameData.settings.crtEffect=v; GameData.saveSettings();});
        UI.drawToggle("PARTICLES", GameData.settings.particles==='High', cx+150, y, 150, 40, v=>{GameData.settings.particles=v?'High':'Low'; GameData.saveSettings();}); y+=g;
        UI.drawSelector("SIDE", ['Left','Right'], GameData.settings.joystickSide, cx, y, 300, 40, v=>{GameData.settings.joystickSide=v; GameData.saveSettings();}); y+=g;
        UI.drawSelector("SIZE", ['Small','Medium','Large'], GameData.settings.joystickSize, cx, y, 300, 40, v=>{GameData.settings.joystickSize=v; GameData.saveSettings();}); y+=g;
        UI.drawToggle("DEBUG HITBOXES", GameData.settings.debugMode, cx, y, 300, 40, v=>{GameData.settings.debugMode=v; GameData.saveSettings();}); y+=g;
        UI.drawButton("RESET DATA", cx, y, 300, 50, '#500', ()=>{if(confirm("Reset?")){GameData.resetProgress(); sceneManager.changeScene('TITLE');}});
        UI.drawButton("BACK", 20, canvas.height-70, 100, 50, '#555', ()=>sceneManager.changeScene('TITLE'));
        UI.handleInput();
    } else if(currentScene==='PAUSED') {
        render(); ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        UI.drawButton('RESUME', canvas.width/2-100, 200, 200, 50, '#00f', ()=>sceneManager.changeScene('PLAYING'));
        UI.drawButton('QUIT', canvas.width/2-100, 270, 200, 50, '#f00', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput();
    } else if(currentScene==='GAME_OVER') {
        render(); ctx.fillStyle='rgba(50,0,0,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#f00'; ctx.fillText("CRITICAL FAILURE", canvas.width/2, 150);
        ctx.fillStyle='#fff'; ctx.fillText(`SCORE: ${score}`, canvas.width/2, 200);
        UI.drawButton('HUB', canvas.width/2-100, 300, 200, 50, '#333', ()=>sceneManager.changeScene('HUB'));
        UI.handleInput();
    } else if(currentScene==='LEVEL_UP') {
        render(); ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#ff0'; ctx.fillText("LEVEL UP", canvas.width/2, 80);
        let y=150;
        upgradeChoices.forEach(c=>{
            UI.drawButton(`${c.t} - ${c.d}`, canvas.width/2-200, y, 400, 60, '#222', ()=>selectUpgrade(c.id)); y+=80;
        });
        UI.handleInput();
    }
    input.clearTaps();
    requestAnimationFrame(gameLoop);
}

// Android Back
window.pauseGame = () => { if(currentScene==='PLAYING') sceneManager.changeScene('PAUSED'); };
window.resumeGame = () => { if(currentScene==='PAUSED') sceneManager.changeScene('PLAYING'); };
history.pushState({page:1},"t","?p=1");
window.onpopstate = () => {
    history.pushState({page:1},"t","?p=1");
    if(currentScene==='PLAYING') sceneManager.changeScene('PAUSED');
    else if(currentScene==='PAUSED') sceneManager.changeScene('PLAYING');
    else if(currentScene!=='TITLE') sceneManager.changeScene('HUB');
};

requestAnimationFrame(gameLoop);
