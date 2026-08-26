// Diagnostic hors ligne : ne se connecte a rien, ne demande pas de jeton valide.
//   npm run verif
process.env.DISCORD_TOKEN ||= 'verification-hors-ligne';
process.env.DISCORD_APPLICATION_ID ||= '000000000000000000';

const { chargerCommandes } = await import('./lib/chargeur.js');
const { generateDependencyReport } = await import('@discordjs/voice');
const { bibliotheque, majeures, lieux } = await import('./lib/musique.js');
const { poser, oublier, selection, TOUS, PARTOUT } = await import('./lib/navigation.js');
const { nomMajeure } = await import('./lib/lieux.js');
const { config } = await import('./config.js');
const { PERMISSIONS, bitfield } = await import('./lib/permissions.js');

let soucis = 0;
const probleme = (m) => { console.log(`  ✗ ${m}`); soucis++; };

console.log('\n── Commandes ' + '─'.repeat(56));
const commandes = await chargerCommandes();
for (const [nom, commande] of [...commandes].sort()) {
  const json = commande.data.toJSON();
  const sous = (json.options ?? []).filter((o) => o.type === 1 || o.type === 2);
  console.log(`  /${nom}${sous.length ? ` — ${sous.length} sous-commandes` : ''}`);

  if (json.description.length > 100) probleme(`/${nom} : description trop longue`);
  if (!/^[-_\p{L}\p{N}]{1,32}$/u.test(json.name)) probleme(`/${nom} : nom invalide`);

  const verifierOptions = (options, prefixe) => {
    for (const o of options ?? []) {
      if (o.description.length > 100) probleme(`${prefixe} ${o.name} : description trop longue`);
      if (o.choices?.length > 25) probleme(`${prefixe} ${o.name} : plus de 25 choix`);
      verifierOptions(o.options, `${prefixe} ${o.name}`);
    }
    if ((options ?? []).length > 25) probleme(`${prefixe} : plus de 25 options`);
  };
  verifierOptions(json.options, `/${nom}`);

  if (typeof commande.autocomplete === 'function') {
    const attendues = JSON.stringify(json).includes('"autocomplete":true');
    if (!attendues) probleme(`/${nom} : autocomplete() defini mais aucune option ne le demande`);
  }
}

console.log('\n── Bibliotheque sonore ' + '─'.repeat(46));
const pistes = bibliotheque({ forcer: true });
console.log(`  Dossier   : ${config.dossierMusique}`);
console.log(`  Pistes    : ${pistes.length}`);

// L arbre tel que le navigateur le montrera : une majeure par ligne, ses lieux
// peuples et leur compte. Les dossiers vides n y figurent pas, comme dans le menu.
for (const m of majeures()) {
  const detail = lieux(m).map((l) => `${l.nom} ${l.nombre}`).join(' · ');
  console.log(`  ${nomMajeure(m).padEnd(10)}: ${detail || '(vide)'}`);
}
if (!pistes.length) {
  console.log('  ℹ Aucun fichier : depose des .mp3 ou .ogg dans ambiance/ ou combat/,');
  console.log('    dans le sous-dossier du lieu, ou a la racine de l un des deux.');
}

console.log('\n── Panneau ' + '─'.repeat(58));
// Le bot ne s est jamais connecte : tout ce qui peut etre prouve hors ligne
// doit l etre. On dessine le panneau sur de fausses sessions et on verifie les
// contraintes de Discord — c est exactement ce qui casse au premier lancement.
{
  const { rendu } = await import('./lib/panneau.js');
  const { AudioPlayerStatus } = await import('@discordjs/voice');
  const { duree } = await import('./lib/duree.js');

  // Une piste d exemple, vraie si la bibliotheque en contient une.
  const exemple = pistes[0] ?? {
    titre: 'Pluie sur le toit', fichier: 'pluie.ogg',
    majeure: 'ambiance', lieu: 'chenlin', categorie: 'ambiance',
    chemin: 'assets/musique/ambiance/chenlin/pluie.ogg', id: 'ambiance/chenlin/pluie.ogg',
  };

  const fausse = (extras) => ({
    guildeId: '0', file: [], courante: null, volume: config.volumeDefaut,
    boucle: 'aucune', rang: 0, total: 0, position: 0,
    statut: AudioPlayerStatus.Idle, ...extras,
  });

  const enLecture = {
    courante: { ...exemple, duree: 237_000 }, position: 102_000,
    rang: 2, total: 7, boucle: 'liste', statut: AudioPlayerStatus.Playing,
    file: [{ titre: 'Auberge au crépuscule' }, { titre: 'Le pont de pierre' }],
  };

  // La vue de navigation ne vit pas dans la session mais dans navigation.js :
  // un cas la pose avant de dessiner, sinon on ne verrait jamais que l accueil.
  const premierLieu = (majeures().length && lieux(majeures()[0])[0]?.slug) || null;

  const cas = [
    ['rien en cours', fausse({})],
    ['en lecture', fausse(enLecture)],
    ['en pause', fausse({ ...enLecture, statut: AudioPlayerStatus.Paused })],
    ['en veille', fausse({ ...enLecture, statut: AudioPlayerStatus.AutoPaused })],
    ['duree inconnue', fausse({ ...enLecture, courante: { ...exemple, duree: null } })],
    ['navigation — tous les lieux', fausse(enLecture), { lieu: TOUS, page: 0 }],
    ['navigation — un lieu', fausse(enLecture), { lieu: premierLieu ?? PARTOUT, page: 0 }],
    ['navigation — page suivante', fausse(enLecture), { lieu: TOUS, page: 1 }],
  ];

  // Les limites de Discord, celles qui font echouer l envoi.
  const LIMITES = { rangees: 5, boutons: 5, options: 25, description: 4096, total: 6000, label: 80 };

  for (const [nom, s, vue] of cas) {
    let m;
    try {
      oublier('0');
      if (vue) poser('0', vue);
      m = rendu(s, null);
    }
    catch (err) { probleme(`Panneau « ${nom} » : ${err.message}`); continue; }

    const embed = m.embeds[0].toJSON();
    const rangees = m.components.map((r) => r.toJSON());

    if (rangees.length > LIMITES.rangees) probleme(`Panneau « ${nom} » : plus de ${LIMITES.rangees} rangees`);
    for (const r of rangees) {
      if (r.components.length > LIMITES.boutons) probleme(`Panneau « ${nom} » : plus de ${LIMITES.boutons} composants sur une rangee`);
      for (const c of r.components) {
        if (c.options?.length > LIMITES.options) probleme(`Panneau « ${nom} » : menu de plus de ${LIMITES.options} entrees`);
        if (c.label && c.label.length > LIMITES.label) probleme(`Panneau « ${nom} » : libelle trop long`);
      }
    }
    if ((embed.description ?? '').length > LIMITES.description) probleme(`Panneau « ${nom} » : description trop longue`);

    const poids = JSON.stringify(embed).length;
    if (poids > LIMITES.total) probleme(`Panneau « ${nom} » : encart de ${poids} caracteres`);
  }

  // L apercu : la seule facon de voir les jauges avant que le bot ne tourne.
  oublier('0');
  const dessin = rendu(cas[1][1], null);
  const apercu = dessin.embeds[0].toJSON();
  console.log(`  ${apercu.title}`);
  for (const l of (apercu.description ?? '').split('\n')) console.log(`  ${l.replace(/\*\*/g, '')}`);
  for (const f of apercu.fields ?? []) console.log(`  ${f.name} : ${f.value.split('\n')[0]}`);
  if (apercu.footer) console.log(`  Position  : ${apercu.footer.text}`);

  // Les libelles de la rangee de navigation : c est la seule facon de voir
  // hors ligne ce qui est propose, et ce qui est grise faute de page suivante.
  const nav = dessin.components[dessin.components.length - 3]?.toJSON();
  const dits = (nav?.components ?? []).map((c) =>
    `${c.label ?? c.emoji?.name ?? '?'}${c.disabled ? ' (grisé)' : ''}`);
  console.log(`  Navigation: ${dits.join(' · ') || '(aucune)'}`);

  const vu = selection('0');
  console.log(`  Menu      : ${vu.lieux.length} lieu(x) · ${vu.pistes.length} piste(s) affichee(s) sur ${vu.total}`);
  console.log(`  Rangees   : ${dessin.components.length} · ${cas.length} cas rendus sans erreur`);

  // On exerce la sonde de duree pour de vrai : c est aussi un test de ffmpeg.
  if (pistes.length) {
    const ms = await duree(pistes[0].chemin);
    console.log(`  Sonde     : ${pistes[0].titre} — ${ms ? `${Math.round(ms / 1000)} s` : 'duree illisible'}`);
    if (!ms) console.log('  ℹ Sans duree, le panneau montre le temps ecoule mais pas de barre.');
  } else {
    console.log('  Sonde     : aucune piste a sonder.');
  }
}

console.log('\n── Permissions ' + '─'.repeat(54));
console.log(`  ${PERMISSIONS.length} permissions demandees · bitfield ${bitfield()}`);
console.log('  Lien : npm run lien');

console.log('\n── Chaine audio ' + '─'.repeat(53));
const rapport = generateDependencyReport();
console.log(rapport.split('\n').filter((l) => l.trim()).map((l) => `  ${l}`).join('\n'));

if (!/opus: .*(?<!not found)$/m.test(rapport) && rapport.includes('Opus: not found')) {
  probleme('Aucun encodeur Opus : la musique ne pourra pas etre diffusee.');
}
if (rapport.includes('Encryption: not found')) probleme('Aucune bibliotheque de chiffrement vocal.');
if (rapport.includes('FFmpeg: not found')) probleme('FFmpeg introuvable : aucune lecture possible.');

// Le rapport ci-dessus interroge les paquets par require : il ne dit pas si
// index.js parvient reellement a les charger. On refait donc le geste du
// demarrage, seul moyen d attraper une entree de module cassee en amont.
const { createRequire } = await import('node:module');
try {
  const sodium = createRequire(import.meta.url)('libsodium-wrappers');
  await sodium.ready;
  console.log('  Chargement  : libsodium se charge comme au demarrage.');
} catch (err) {
  probleme(`libsodium ne se charge pas : ${err.message}`);
}

console.log('\n' + '─'.repeat(69));
console.log(soucis ? `  ${soucis} probleme(s) a regler.\n` : '  Tout est en ordre.\n');
process.exit(soucis ? 1 : 0);
