// Meme chose que /d, sous le nom auquel les joueurs sont habitues.
import { construire, executer } from '../lib/commande-des.js';

export const data = construire('r', 'Lancer les dés : 6 → 1d6, ou 1d100, 1D20, 2d6+3, 4d6kh3');
export const execute = executer;

export default { data, execute };
