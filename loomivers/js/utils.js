import { DefaultGameData } from './constants.js';

// --- UTILS ---
export function deepMerge(defaults, saved) {
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

export const GameData = {
    progress: JSON.parse(JSON.stringify(DefaultGameData.progress)),
    settings: JSON.parse(JSON.stringify(DefaultGameData.settings)),

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
            console.error("Save Data Corrupt, resetting to defaults", e);
        }
    },

    resetProgress() {
        this.progress = JSON.parse(JSON.stringify(DefaultGameData.progress));
        this.saveProgress();
    }
};

export class ObjectPool {
    constructor(createFn, initialSize = 100) {
        this.createFn = createFn;
        this.pool = [];
        this.active = [];

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
    }

    get() {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            obj = this.createFn();
        }
        obj.active = true;
        this.active.push(obj);
        return obj;
    }

    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            obj.active = false;
            this.pool.push(obj);
        }
    }

    reset() {
        while(this.active.length > 0) {
            const obj = this.active.pop();
            obj.active = false;
            this.pool.push(obj);
        }
    }
}

export function checkRectCollide(r1, r2) {
    return (r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y);
}
