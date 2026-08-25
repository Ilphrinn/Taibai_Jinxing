// Palette et fragments de mise en forme communs a toutes les commandes.
export const COULEURS = {
  or: 0xC8A951,        // Taibai Jinxing, l'etoile d'or
  cinabre: 0xB03A2E,   // combat, danger
  jade: 0x2E8B7A,      // reussite, soin
  encre: 0x2C2C34,     // neutre, narration
  pourpre: 0x6C3483,   // surnaturel, oracle
};

export const WU_XING = {
  bois:  { hanzi: '木', pinyin: 'Mu',   emoji: '🌿', engendre: 'feu',   couleur: 0x4E9A51, sens: 'croissance, elan, colere' },
  feu:   { hanzi: '火', pinyin: 'Huo',  emoji: '🔥', engendre: 'terre', couleur: 0xC0392B, sens: 'ardeur, esprit, joie' },
  terre: { hanzi: '土', pinyin: 'Tu',   emoji: '⛰️', engendre: 'metal', couleur: 0xB9973E, sens: 'endurance, appui, souci' },
  metal: { hanzi: '金', pinyin: 'Jin',  emoji: '⚔️', engendre: 'eau',   couleur: 0xAAB7B8, sens: 'rigueur, tranchant, deuil' },
  eau:   { hanzi: '水', pinyin: 'Shui', emoji: '🌊', engendre: 'bois',  couleur: 0x2E86C1, sens: 'ruse, memoire, peur' },
};

export const ORDRE_WU_XING = ['bois', 'feu', 'terre', 'metal', 'eau'];

// Cycle de destruction (ke) : ce que chaque element domine.
export const DOMINE = { bois: 'terre', terre: 'eau', eau: 'feu', feu: 'metal', metal: 'bois' };

export const SIGNATURE = 'Taibai Jinxing 太白金星';
