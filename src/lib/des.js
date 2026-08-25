// Analyse et lancer de des. Notation : 2d6+3, d20, 4d6kh3, 3d10kl1, 1d20+2-1
import crypto from 'node:crypto';

const MAX_DES = 100;
const MAX_FACES = 1000;

// Tirage uniforme sans biais (rejet), sur la source aleatoire du systeme.
export function dLance(faces) {
  if (faces < 2 || faces > MAX_FACES) throw new Error(`Nombre de faces invalide : ${faces}`);
  const limite = Math.floor(0xFFFFFFFF / faces) * faces;
  let n;
  do { n = crypto.randomBytes(4).readUInt32BE(0); } while (n >= limite);
  return (n % faces) + 1;
}

const TERME = /^([+-])?\s*(?:(\d*)[dD](\d+)((?:kh|kl)\d+)?|(\d+))$/;

/**
 * Evalue une expression de des.
 * @returns {{total:number, detail:string, jets:Array}}
 */
export function evaluer(expression) {
  const brut = String(expression).trim().toLowerCase().replace(/\s+/g, '');
  if (!brut) throw new Error('Expression vide.');
  if (brut.length > 100) throw new Error('Expression trop longue.');

  // Decoupe en termes signes : "2d6+3-1" -> ["2d6", "+3", "-1"]
  const morceaux = brut.match(/[+-]?[^+-]+/g);
  if (!morceaux) throw new Error(`Expression incomprise : ${expression}`);

  let total = 0;
  const parties = [];
  const jets = [];
  let totalDes = 0;

  for (const morceau of morceaux) {
    const m = morceau.match(TERME);
    if (!m) throw new Error(`Terme incompris : « ${morceau} »`);
    const signe = m[1] === '-' ? -1 : 1;

    if (m[5] !== undefined) {                       // constante
      const v = Number(m[5]);
      total += signe * v;
      parties.push(`${signe < 0 ? '−' : '+'}${v}`);
      continue;
    }

    const nb = m[2] === '' ? 1 : Number(m[2]);
    const faces = Number(m[3]);
    const garde = m[4] ?? null;

    if (nb < 1 || nb > MAX_DES) throw new Error(`Entre 1 et ${MAX_DES} des, pas ${nb}.`);
    if (faces < 2 || faces > MAX_FACES) throw new Error(`Entre 2 et ${MAX_FACES} faces, pas ${faces}.`);
    totalDes += nb;
    if (totalDes > MAX_DES) throw new Error(`Trop de des au total (max ${MAX_DES}).`);

    const valeurs = Array.from({ length: nb }, () => dLance(faces));
    let retenus = valeurs.map((v, i) => ({ v, i, garde: true }));

    if (garde) {
      const combien = Math.min(Number(garde.slice(2)), nb);
      const tri = [...retenus].sort((a, b) => (garde.startsWith('kh') ? b.v - a.v : a.v - b.v));
      const gardesIdx = new Set(tri.slice(0, combien).map((d) => d.i));
      retenus = retenus.map((d) => ({ ...d, garde: gardesIdx.has(d.i) }));
    }

    const somme = retenus.filter((d) => d.garde).reduce((s, d) => s + d.v, 0);
    total += signe * somme;

    const affiche = retenus
      .map((d) => (d.garde ? (faces >= 6 && (d.v === faces || d.v === 1) ? `**${d.v}**` : `${d.v}`) : `~~${d.v}~~`))
      .join(', ');
    parties.push(`${signe < 0 ? '−' : parties.length ? '+' : ''}${nb}d${faces}${garde ?? ''} [${affiche}]`);
    jets.push({ nb, faces, valeurs, somme: signe * somme });
  }

  return { total, detail: parties.join(' ').replace(/^\+/, ''), jets, expression: brut };
}

/** Jet de reference du systeme : d20 + attribut + bonus. */
export function jetDAction({ attribut = 0, bonus = 0, avantage = 'aucun' } = {}) {
  const a = dLance(20);
  const b = avantage === 'aucun' ? null : dLance(20);
  const des = b === null ? [a] : [a, b];
  const brut = b === null ? a : (avantage === 'avantage' ? Math.max(a, b) : Math.min(a, b));
  return {
    des,
    brut,
    total: brut + attribut + bonus,
    critique: brut === 20,
    echecCritique: brut === 1,
  };
}
