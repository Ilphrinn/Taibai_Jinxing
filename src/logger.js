// Journal minimal : une ligne, un horodatage, pas de dependance.
import { config } from './config.js';

const NIVEAUX = { debug: 10, info: 20, warn: 30, error: 40 };
const seuil = NIVEAUX[config.journalNiveau] ?? NIVEAUX.info;

const heure = () => new Date().toISOString().slice(11, 19);

function ecrire(niveau, symbole, args) {
  if (NIVEAUX[niveau] < seuil) return;
  const flux = niveau === 'error' || niveau === 'warn' ? console.error : console.log;
  flux(`${heure()} ${symbole}`, ...args);
}

export const log = {
  debug: (...a) => ecrire('debug', '·', a),
  info: (...a) => ecrire('info', '›', a),
  warn: (...a) => ecrire('warn', '!', a),
  error: (...a) => ecrire('error', '✗', a),
  ok: (...a) => ecrire('info', '✓', a),
};
