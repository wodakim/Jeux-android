
function deepMerge(defaults, saved) {
    const result = { ...defaults };
    for (const key in saved) {
        if (typeof saved[key] === 'object' && saved[key] !== null && !Array.isArray(saved[key]) && typeof defaults[key] === 'object') {
            result[key] = deepMerge(defaults[key], saved[key]);
        } else {
            result[key] = saved[key];
        }
    }
    return result;
}

const DefaultGameData = {
    progress: {
        highScore: 0,
        currency: 0,
        skins: ['NEON_CYAN'],
        currentSkin: 'NEON_CYAN',
        unlockedChars: ['WEAVER', 'ARCHITECT', 'GLITCH_WITCH'],
        upgrades: { health: 0, magnet: 0, damage: 0, greed: 0 },
        achievements: [],
        bestiary: {},
        nemesis: null,
        storySeen: false
    },

    settings: {
        masterVolume: 1.0,
        crtEffect: true,
        particles: 'High',
        joystickSide: 'Left',
        joystickSize: 'Medium',
        debugMode: false
    }
};

export const GameData = {
    progress: { ...DefaultGameData.progress },
    settings: { ...DefaultGameData.settings },

    saveProgress() {
        localStorage.setItem('loomivers_progress', JSON.stringify(this.progress));
    },

    saveSettings() {
        localStorage.setItem('loomivers_settings', JSON.stringify(this.settings));
    },

    load() {
        try {
            const prog = localStorage.getItem('loomivers_progress');
            if (prog) {
                this.progress = deepMerge(DefaultGameData.progress, JSON.parse(prog));
            }
            const set = localStorage.getItem('loomivers_settings');
            if (set) {
                this.settings = deepMerge(DefaultGameData.settings, JSON.parse(set));
            }
        } catch (e) {
            console.error("Save Data Corrupt", e);
        }
    },

    resetProgress() {
        this.progress = JSON.parse(JSON.stringify(DefaultGameData.progress));
        this.saveProgress();
    }
};

export class AudioController {
    constructor() {
        this.initialized = false;
        this.sequencerTimer = null;
        this.beatIndex = 0;
        this.audioCtx = null;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        // Silent buffer
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);

        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.initialized = true;
    }

    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.init();
    }

    playTone(type, freq, dur, volMult = 1.0) {
        if (!this.initialized || GameData.settings.masterVolume <= 0) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1 * GameData.settings.masterVolume * volMult, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + dur);
    }

    playPing() { this.playTone('sine', 800, 0.1); }
    playCrunch() { this.playTone('sawtooth', 100, 0.2); }

    playLevelUp() {
        if (!this.initialized) return;
        [440, 554, 659, 880].forEach((f,i) => setTimeout(() => this.playTone('square', f, 0.1), i*100));
    }

    startMusic() {
        if (this.sequencerTimer) return;
        this.beatIndex = 0;
        const sequence = [65.41, 65.41, 49.00, 49.00, 55.00, 55.00, 43.65, 43.65];

        this.sequencerTimer = setInterval(() => {
            if (GameData.settings.masterVolume > 0) {
                const freq = sequence[this.beatIndex % sequence.length];
                this.playTone('sawtooth', freq, 0.2, 0.3);
                this.beatIndex++;
            }
        }, 250); // 120 BPM 8th notes roughly
    }

    stopMusic() {
        if (this.sequencerTimer) {
            clearInterval(this.sequencerTimer);
            this.sequencerTimer = null;
        }
    }
}

export const audioController = new AudioController();
