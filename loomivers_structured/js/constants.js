
export const CHARACTERS = {
    WEAVER: { name: 'The Weaver', desc: 'Balanced. Starts with Neon Wand.', weapon: 'NEON_WAND', stat: 'Balanced', color: '#0ff', price: 0 },
    ARCHITECT: { name: 'The Architect', desc: 'Defensive. Orbiting Data Shield.', weapon: 'DATA_ORBIT', stat: 'Defense', color: '#00f', price: 0 },
    GLITCH_WITCH: { name: 'Glitch Witch', desc: 'Chaos. Spawns Reality Tears.', weapon: 'REALITY_TEAR', stat: 'Area Dmg', color: '#f0f', price: 0 },
    TANK: { name: 'The Tank', desc: 'Knockback King. Force Field.', weapon: 'FORCE_FIELD', stat: 'Health', color: '#0a0', price: 500 },
    SNIPER: { name: 'The Sniper', desc: 'Piercing Railgun.', weapon: 'PIXEL_RAIL', stat: 'Range', color: '#ff0', price: 500 },
    VIRUS: { name: 'The Virus', desc: 'Poison Trail.', weapon: 'CORRUPT_CLOUD', stat: 'DoT', color: '#0f0', price: 1000 },
    SUMMONER: { name: 'The Summoner', desc: 'Deploys Auto-Turrets.', weapon: 'AUTO_TURRET', stat: 'Minions', color: '#a0f', price: 1000 },
    NINJA: { name: 'The Ninja', desc: 'Bouncing Shuriken.', weapon: 'CYBER_SHURIKEN', stat: 'Agility', color: '#aaa', price: 1500 },
    BERSERKER: { name: 'The Berserker', desc: 'Melee Void Axe.', weapon: 'VOID_AXE', stat: 'Melee', color: '#f00', price: 2000 },
    GAMBLER: { name: 'The Gambler', desc: 'RNG Damage.', weapon: 'DICE_BOMB', stat: 'Luck', color: '#fa0', price: 2500 }
};

export const UPGRADES = [
    { id: 'health', name: 'MAX HP', desc: '+10 HP per Level' },
    { id: 'damage', name: 'DAMAGE', desc: '+5% DMG per Level' },
    { id: 'magnet', name: 'MAGNET', desc: '+20 Range per Level' },
    { id: 'greed', name: 'GREED', desc: '+10% Loot Chance' }
];

export const WEAPON_TYPES = ['NEON_WAND', 'DATA_ORBIT', 'GLITCH_BOMB', 'REALITY_TEAR', 'FORCE_FIELD', 'PIXEL_RAIL', 'CORRUPT_CLOUD', 'AUTO_TURRET', 'CYBER_SHURIKEN', 'VOID_AXE', 'DICE_BOMB'];
