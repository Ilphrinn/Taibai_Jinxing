// Niveau sonore d un fichier, et le gain qu il faut lui appliquer.
//
// Des fichiers d origines diverses n ont pas du tout le meme niveau : la piste
// de combat hurle, l ambiance chuchote, et on passe la seance sur les boutons
// de volume. « volumedetect » de ffmpeg donne le niveau moyen et le niveau
// crete du fichier ; de la on deduit un gain, une fois pour toutes.
//
// Meme geste que lib/duree.js, deja eprouve : spawn de ffmpeg, lecture de sa
// sortie d erreur, cache par « chemin + mtime », promesse mise en cache pour ne
// pas lancer deux sondes sur le meme fichier. Pas d ffprobe, meme raison.
//
// La difference avec la duree : volumedetect DECODE LE FICHIER ENTIER, soit une
// a trois secondes de processeur par piste. C est pourquoi la sonde n est
// jamais attendue, et pourquoi on ne la lance pas sur toute la bibliotheque au
// demarrage.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import ffmpegStatique from 'ffmpeg-static';
import { config } from '../config.js';
import { log } from '../logger.js';

const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatique;

// « [Parsed_volumedetect_0 @ 0x…] mean_volume: -23.4 dB »
const MOYEN = /mean_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/;
const CRETE = /max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/;

// Bornes du gain, en decibels. Une piste tres silencieuse n a pas a devenir un
// souffle amplifie, et une piste deja forte n a pas a etre ecrasee.
const GAIN_MAX_DB = 12;

// On ne pousse jamais la crete au-dela de ce niveau : au-dela, ca ecrete.
const CRETE_MAX_DB = -1;

const cache = new Map();

const cle = (chemin) => {
  try { return `${chemin} ${fs.statSync(chemin).mtimeMs}`; }
  catch { return null; }
};

const enGain = (db) => 10 ** (db / 20);

/**
 * Le facteur multiplicatif a appliquer pour amener la piste au niveau vise.
 * Renvoie 1 si la mesure ne dit rien d exploitable — un niveau inconnu n est
 * pas une erreur, exactement comme une duree inconnue.
 */
function calculer(moyen, crete) {
  if (!Number.isFinite(moyen)) return 1;
  let db = config.niveauCibleDb - moyen;
  // Sans depasser la crete admissible : c est cette borne qui evite l ecretage
  // sur une piste dont le niveau moyen est bas mais qui a des pics.
  if (Number.isFinite(crete)) db = Math.min(db, CRETE_MAX_DB - crete);
  db = Math.max(-GAIN_MAX_DB, Math.min(GAIN_MAX_DB, db));
  return enGain(db);
}

function sonder(chemin) {
  return new Promise((resoudre) => {
    let sortie = '';
    let fils;
    try {
      fils = spawn(
        FFMPEG,
        ['-hide_banner', '-nostats', '-i', chemin, '-af', 'volumedetect', '-f', 'null', '-'],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
    } catch (err) {
      log.debug(`Sonde de niveau impossible (${chemin}) : ${err.message}`);
      resoudre(null);
      return;
    }

    // volumedetect n imprime son resume qu a la toute fin : contrairement a la
    // sonde de duree, on ne peut pas se contenter des premieres lignes. On
    // garde donc la fin du flux plutot que son debut.
    fils.stderr.on('data', (bloc) => {
      sortie += bloc;
      if (sortie.length > 65_536) sortie = sortie.slice(-32_768);
    });
    fils.on('error', (err) => {
      log.debug(`ffmpeg introuvable pour la sonde de niveau : ${err.message}`);
      resoudre(null);
    });
    fils.on('close', () => {
      const m = MOYEN.exec(sortie);
      if (!m) { resoudre(null); return; }
      const c = CRETE.exec(sortie);
      resoudre({
        moyen: Number(m[1]),
        crete: c ? Number(c[1]) : null,
        gain: calculer(Number(m[1]), c ? Number(c[1]) : null),
      });
    });
  });
}

/**
 * Mesure le fichier. Resultat { moyen, crete, gain } en decibels, ou null si
 * ffmpeg n a rien su en dire.
 */
export async function niveau(chemin) {
  if (!config.niveauCibleDb) return null;
  const k = cle(chemin);
  if (!k) return null;
  if (cache.has(k)) return cache.get(k);

  const promesse = sonder(chemin);
  cache.set(k, promesse);
  const mesure = await promesse;
  cache.set(k, mesure);
  return mesure;
}

/** Lance la mesure sans l attendre : de quoi preparer la piste suivante. */
export function prevoir(chemin) {
  if (chemin) niveau(chemin).catch(() => { /* un niveau inconnu n est pas une erreur */ });
}

/** Le gain deja mesure, sans rien lancer. 1 tant qu on ne sait pas. */
export function gainConnu(chemin) {
  const v = cache.get(cle(chemin));
  return v && typeof v === 'object' && typeof v.gain === 'number' ? v.gain : 1;
}

export function oublierNiveaux() { cache.clear(); }
