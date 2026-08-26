// La table des lieux de la campagne : le seul endroit qui sache leur nom
// affiche, leur glose et surtout leur ORDRE.
//
// Sur le disque, un lieu est un dossier nomme par son slug, sans accent ni
// apostrophe : « vallee-fantome ». C est delibere — un tri alphabetique sur les
// noms affiches melangerait « L au-dela » et « Chenlin », et les accents dans un
// nom de dossier traversent git, Docker et Railway sans qu on ait pu le
// verifier. Le nom accentue vit ici, dans une chaine, ou il ne risque rien.
//
// Un dossier absent de cette table n est PAS une erreur : il s affiche sous son
// slug et se range en fin de liste. Ajouter une region, c est ajouter une ligne
// ici et creer le dossier ; rien d autre.

/** Les douze regions numerotees, puis les lieux hors numerotation. */
export const LIEUX = [
  { slug: 'chenlin', nom: 'Chenlin', glose: 'forêt de bambou enchantée, le temps y glisse' },
  { slug: 'xanya', nom: 'Xanya', glose: 'plaine du roi Harpie, Sanzuwu et les neuf soleils' },
  { slug: 'mortes-terres', nom: 'Les Mortes-Terres', glose: 'terre morte violette, l’arbre né du malheur' },
  { slug: 'huangxin', nom: 'HuangXin', glose: 'la capitale, le Palais impérial, l’entrée du Rêve' },
  { slug: 'portes-de-l-enfer', nom: 'Les Portes de l’Enfer', glose: 'volcan et puits ouvert sur les enfers' },
  { slug: 'jiuyi', nom: 'Jiuyi', glose: 'jungle et côtes, les réfugiés, les Sept Marées' },
  { slug: 'heibing', nom: 'Heibing', glose: 'neige, Palais céleste et escaliers vers le ciel' },
  { slug: 'shaluo-zhou', nom: 'Shaluo Zhou', glose: 'désert, oasis du Lotus, temple des mirages' },
  { slug: 'muye', nom: 'Muye', glose: 'steppes du Khan, héritiers de Lu Bu', propose: true },
  { slug: 'vallee-fantome', nom: 'Vallée Fantôme', glose: 'la secte de Su Bao, l’équilibre du monde' },
  { slug: 'guanghan', nom: 'Guanghan', glose: 'la Lune, Chang’e, la prophétie', propose: true },
  { slug: 'mont-tien', nom: 'Mont Tien', glose: 'on n’y monte que si l’on est déjà immortel' },

  // Hors numerotation.
  { slug: 'le-reve', nom: 'Le Rêve', glose: 'copie du monde, un futur où tout a échoué' },
  { slug: 'donghai', nom: 'Donghai', glose: 'la mer de l’est, entre Jiuyi et Fusang' },
  { slug: 'fusang', nom: 'Fusang', glose: 'l’archipel' },
  { slug: 'fonds-marins', nom: 'Les Fonds marins', glose: 'la civilisation engloutie, cinquième palier' },
  { slug: 'enfers', nom: 'Les Enfers', glose: 'le plan démoniaque, le roi-démon et le Fléau' },
  { slug: 'au-dela', nom: 'L’au-delà', glose: 'nord lumineux, sud démoniaque, centre d’entraînement' },
];

/** Une piste posee a la racine d une majeure ne tient a aucun lieu. */
export const SANS_LIEU = { nom: 'Partout', glose: 'sans lieu particulier, bon en toute occasion' };

/** Les deux categories majeures. Un autre dossier de tete reste atteignable. */
export const MAJEURES = [
  { slug: 'ambiance', nom: 'Ambiance', icone: '🎐' },
  { slug: 'combat', nom: 'Combat', icone: '⚔️' },
];

const PAR_SLUG = new Map(LIEUX.map((l, i) => [l.slug, { ...l, rang: i }]));
const MAJEURE_PAR_SLUG = new Map(MAJEURES.map((m, i) => [m.slug, { ...m, rang: i }]));

/** L entree de la table, ou null si ce dossier n y figure pas. */
export function lieuConnu(slug) {
  return slug ? PAR_SLUG.get(slug) ?? null : null;
}

/** -1 pour « Partout », le rang de la table sinon, l infini pour l inconnu. */
export function rangLieu(slug) {
  if (!slug) return -1;
  return PAR_SLUG.get(slug)?.rang ?? Infinity;
}

/** Tri des lieux : Partout d abord, la table dans son ordre, l inconnu apres. */
export function comparerLieu(a, b) {
  const ra = rangLieu(a), rb = rangLieu(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return (a ?? '').localeCompare(b ?? '');
}

export function majeureConnue(slug) {
  return MAJEURE_PAR_SLUG.get(slug) ?? null;
}

export function rangMajeure(slug) {
  return MAJEURE_PAR_SLUG.get(slug)?.rang ?? Infinity;
}

export function comparerMajeure(a, b) {
  const ra = rangMajeure(a), rb = rangMajeure(b);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.localeCompare(b);
}

/** Le nom a afficher : celui de la table, sinon le slug tel quel. */
export function nomLieu(slug) {
  if (!slug) return SANS_LIEU.nom;
  return PAR_SLUG.get(slug)?.nom ?? slug;
}

export function nomMajeure(slug) {
  return MAJEURE_PAR_SLUG.get(slug)?.nom ?? slug;
}

export function iconeMajeure(slug) {
  return MAJEURE_PAR_SLUG.get(slug)?.icone ?? '🎵';
}

export default { LIEUX, MAJEURES, SANS_LIEU, lieuConnu, nomLieu, nomMajeure, iconeMajeure };
