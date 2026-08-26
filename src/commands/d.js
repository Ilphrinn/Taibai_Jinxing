// Lancer de des. Tout est dans lib/commande-des.js, partage avec /r.
import { construire, executer } from '../lib/commande-des.js';

export const data = construire('d', 'Lancer les dés : 6 → 1d6, ou 3d100, 1D20, 2d6+3, 4d6kh3');
export const execute = executer;

export default { data, execute };
