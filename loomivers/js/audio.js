import { GameData } from './utils.js';

export class AudioController {
    constructor() {
        this.initialized = false;
        this.audioCtx = null;
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
        } catch (e) {
            console.warn("AudioContext init failed", e);
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
