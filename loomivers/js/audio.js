import { GameData } from './utils.js';

export class AudioController {
    constructor() {
        this.initialized = false;
        this.audioCtx = null;
        this.bgmOsc = null;
        this.bgmGain = null;
        this.bgmLfo = null;
        this.isBossMode = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.audioCtx = new AudioContext();

            // Create a buffer and play it to unlock audio on iOS
            const buffer = this.audioCtx.createBuffer(1, 1, 22050);
            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioCtx.destination);
            source.start(0);

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            this.initialized = true;
            this.playBgm();
        } catch (e) {
            console.warn("AudioContext init failed", e);
        }
    }

    playBgm() {
        if (!this.audioCtx) return;

        const vol = GameData.settings.masterVolume;
        if (vol <= 0) return;

        // Base Drone
        this.bgmOsc = this.audioCtx.createOscillator();
        this.bgmGain = this.audioCtx.createGain();
        this.bgmOsc.type = 'sawtooth'; // Grittier sound
        this.bgmOsc.frequency.value = 55; // A1 (Low Drone)

        // Low Pass Filter for that "muffled" space sound
        this.bgmFilter = this.audioCtx.createBiquadFilter();
        this.bgmFilter.type = 'lowpass';
        this.bgmFilter.frequency.value = 400;

        // LFO for movement
        this.bgmLfo = this.audioCtx.createOscillator();
        this.bgmLfoGain = this.audioCtx.createGain();
        this.bgmLfo.frequency.value = 0.2; // Slow pulse
        this.bgmLfoGain.gain.value = 100;

        // Connections
        this.bgmLfo.connect(this.bgmLfoGain);
        this.bgmLfoGain.connect(this.bgmFilter.frequency); // Modulate filter cutoff

        this.bgmOsc.connect(this.bgmFilter);
        this.bgmFilter.connect(this.bgmGain);
        this.bgmGain.connect(this.audioCtx.destination);

        this.bgmGain.gain.setValueAtTime(0.05 * vol, this.audioCtx.currentTime);

        this.bgmOsc.start();
        this.bgmLfo.start();
    }

    setBossMode(active) {
        if (!this.initialized || !this.bgmOsc) return;
        this.isBossMode = active;
        const now = this.audioCtx.currentTime;

        if (active) {
            // Boss Mode: Faster, higher pitch, more intense
            this.bgmOsc.frequency.linearRampToValueAtTime(110, now + 2); // A2
            this.bgmLfo.frequency.linearRampToValueAtTime(4.0, now + 2); // Fast pulse
            this.bgmGain.gain.linearRampToValueAtTime(0.08 * GameData.settings.masterVolume, now + 2);
        } else {
            // Normal Mode: Slow, deep
            this.bgmOsc.frequency.linearRampToValueAtTime(55, now + 2); // A1
            this.bgmLfo.frequency.linearRampToValueAtTime(0.2, now + 2); // Slow pulse
            this.bgmGain.gain.linearRampToValueAtTime(0.05 * GameData.settings.masterVolume, now + 2);
        }
    }

    playPing() {
        if (!this.initialized || !this.audioCtx) return;
        const vol = GameData.settings.masterVolume;
        if (vol <= 0) return;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.1 * vol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.1);
        } catch(e) { console.warn("playPing error", e); }
    }

    playCrunch() {
        if (!this.initialized || !this.audioCtx) return;
        const vol = GameData.settings.masterVolume;
        if (vol <= 0) return;

        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.1 * vol, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.2);
        } catch(e) { console.warn("playCrunch error", e); }
    }

    playLevelUp() {
        if (!this.initialized || !this.audioCtx) return;
        const vol = GameData.settings.masterVolume;
        if (vol <= 0) return;

        try {
            const now = this.audioCtx.currentTime;
            [440, 554, 659, 880].forEach((freq, i) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'square';
                osc.frequency.value = freq;

                gain.gain.setValueAtTime(0.1 * vol, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.1);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.1);
            });
        } catch(e) { console.warn("playLevelUp error", e); }
    }
}

export const audioController = new AudioController();
