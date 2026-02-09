// --- CONSTANTS ---
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

export const CHARACTERS = {
    'WEAVER': { name: 'The Weaver', desc: 'Balanced. Master of the code.', color: '#0ff', weapon: 'NEON_WAND', price: 0 },
    'ARCHITECT': { name: 'Architect', desc: 'Tanky but slow.', color: '#0a0', weapon: 'FORCE_FIELD', price: 1000, hpBonus: 50, speedBonus: -20 },
    'GLITCH_WITCH': { name: 'Glitch Witch', desc: 'High risk, high damage.', color: '#f0f', weapon: 'GLITCH_BOMB', price: 2000, hpBonus: -20, dmgBonus: 0.5 },
    'SNIPER': { name: 'Pixel Sniper', desc: 'Long range precision.', color: '#ff0', weapon: 'PIXEL_RAIL', price: 3000, speedBonus: 20 },
    'BERSERKER': { name: 'Void Walker', desc: 'Melee specialist.', color: '#500', weapon: 'VOID_AXE', price: 4000, hpBonus: 100, speedBonus: 10 },
    'ROUTER': { name: 'The Router', desc: 'Fast movement, weak body.', color: '#fa0', weapon: 'DATA_ORBIT', price: 5000, hpBonus: -30, speedBonus: 50 },
    'KERNEL': { name: 'Kernel Guardian', desc: 'Heavy armor, slow atk.', color: '#00f', weapon: 'FORCE_FIELD', price: 6000, hpBonus: 150, dmgBonus: -0.2 },
    'VIRUS': { name: 'Null Virus', desc: 'Lifesteal (concept).', color: '#0f0', weapon: 'GLITCH_BOMB', price: 7000, hpBonus: 0, dmgBonus: 0.2 },
    'PROTOCOL': { name: 'Protocol Droid', desc: 'Rapid fire, low dmg.', color: '#ccc', weapon: 'NEON_WAND', price: 8000, fireRateBonus: 0.5, dmgBonus: -0.3 },
    'OVERLORD': { name: 'System Overlord', desc: 'Ultimate power.', color: '#fff', weapon: 'PIXEL_RAIL', price: 10000, hpBonus: 200, dmgBonus: 1.0 }
};

export const DefaultGameData = {
    progress: {
        highScore: 0,
        currency: 0,
        skins: ['NEON_CYAN'],
        currentSkin: 'NEON_CYAN',
        unlockedChars: ['WEAVER'],
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
        joystickSize: 'Medium'
    }
};
