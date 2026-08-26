// Ou en est le panneau dans la bibliotheque : quelle majeure, quel lieu, quelle
// page. Rien de plus.
//
// Pourquoi ici et pas dans la session : le panneau existe AVANT toute session —
// on doit pouvoir feuilleter la bibliotheque sans etre en vocal, et la session
// est detruite des que le salon se vide. Une vue rangee dans la session
// disparaitrait a chaque silence. C est donc une Map de module, clef guildeId,
// comme la memoire des pochettes dans panneau.js.
//
// Elle se vide au redemarrage : le panneau repart alors en haut de
// l arborescence au clic suivant. Assume — un redeploiement coupe deja la
// musique, il n y a rien de precieux a sauver ici.
import { bibliotheque, majeures, lieux } from './musique.js';

// Discord plafonne un menu deroulant a vingt-cinq entrees : c est la taille
// d une page, et le seul endroit du code qui ait besoin de le savoir.
export const PAR_PAGE = 25;

// Valeur du menu pour « tous les lieux de cette majeure ». Un slug de dossier
// ne peut pas valoir « * » : aucune collision possible.
export const TOUS = '*';

// Valeur du menu pour le bac « Partout » — les pistes posees a la racine d une
// majeure. Meme raison : un dossier ne s appelle pas « . ».
export const PARTOUT = '.';

const vues = new Map();

function neuve() {
  return { majeure: null, lieu: TOUS, page: 0 };
}

/** La vue de ce serveur, telle quelle. Ne corrige rien : voir selection(). */
export function vue(guildeId) {
  if (!guildeId) return neuve();
  let v = vues.get(guildeId);
  if (!v) { v = neuve(); vues.set(guildeId, v); }
  return v;
}

/** Modifie la vue et la retourne. Les bornes sont posees par selection(). */
export function poser(guildeId, modif) {
  const v = { ...vue(guildeId), ...modif };
  if (guildeId) vues.set(guildeId, v);
  return v;
}

/** A appeler quand on pose un panneau neuf : on repart en haut. */
export function oublier(guildeId) { vues.delete(guildeId); }

/** Les pistes d une majeure et d un lieu, dans l ordre de la bibliotheque. */
function filtrer(majeure, lieu) {
  return bibliotheque().filter((p) => {
    if (p.majeure !== majeure) return false;
    if (lieu === TOUS) return true;
    if (lieu === PARTOUT) return p.lieu === null;
    return p.lieu === lieu;
  });
}

/**
 * Ce que le panneau doit montrer, une vue fausse etant corrigee au passage :
 * majeure disparue du disque, lieu vide, page au-dela du dernier ecran. La vue
 * memorisee est reecrite pour que le prochain clic parte du bon endroit.
 */
export function selection(guildeId) {
  const toutes = majeures();
  const v = vue(guildeId);

  // Majeure absente ou disparue : on prend la premiere venue (ambiance, puis
  // combat, puis le reste).
  const majeure = toutes.includes(v.majeure) ? v.majeure : toutes[0] ?? null;

  const disponibles = majeure ? lieux(majeure) : [];
  const slugs = disponibles.map((l) => l.slug);

  // Un lieu qu on a vide entre deux clics ramene a la majeure entiere.
  let lieu = v.lieu;
  if (lieu === PARTOUT) lieu = slugs.includes(null) ? PARTOUT : TOUS;
  else if (lieu !== TOUS && !slugs.includes(lieu)) lieu = TOUS;

  const pistes = filtrer(majeure, lieu);

  const pages = Math.max(1, Math.ceil(pistes.length / PAR_PAGE));
  const page = Math.min(Math.max(0, v.page), pages - 1);

  if (majeure !== v.majeure || lieu !== v.lieu || page !== v.page) {
    poser(guildeId, { majeure, lieu, page });
  }

  return {
    majeure,
    lieu,
    majeures: toutes,
    lieux: disponibles,
    pistes: pistes.slice(page * PAR_PAGE, (page + 1) * PAR_PAGE),
    total: pistes.length,
    page,
    pages,
  };
}

/** La majeure suivante, en tournant. Sert au bouton qui les fait defiler. */
export function majeureSuivante(guildeId) {
  const toutes = majeures();
  if (!toutes.length) return null;
  const { majeure } = selection(guildeId);
  const i = toutes.indexOf(majeure);
  return toutes[(i + 1) % toutes.length];
}

/** Toutes les pistes de la selection courante, pages comprises : de quoi jouer. */
export function pistesDeLaSelection(guildeId) {
  const { majeure, lieu } = selection(guildeId);
  return filtrer(majeure, lieu);
}

export default { vue, poser, oublier, selection, PAR_PAGE, TOUS, PARTOUT };
