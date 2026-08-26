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

// Le piege de Git LFS : une construction Docker ne recupere pas forcement les
// objets, et l image se retrouve avec des pointeurs de 132 octets au lieu des
// fichiers. Toutes les pistes echoueraient a la lecture sans dire pourquoi.
// On les reconnait a leur taille et a leur premiere ligne.
{
  const fs = await import('node:fs');
  const pointeurs = pistes.filter((p) => {
    try {
      if (fs.statSync(p.chemin).size > 200) return false;
      const tete = fs.readFileSync(p.chemin, 'latin1').slice(0, 40);
      return tete.startsWith('version https://git-lfs');
    } catch { return false; }
  });
  if (pointeurs.length) {
    probleme(`${pointeurs.length} piste(s) ne sont que des pointeurs Git LFS, pas du son.`);
    console.log('    Les objets LFS n ont pas ete recuperes ici. Voir README, section 5 :');
    console.log('    le plus sur est de versionner l audio SANS LFS.');
  }
}

console.log('\n── Panneau ' + '─'.repeat(58));
// Le bot ne s est jamais connecte : tout ce qui peut etre prouve hors ligne
// doit l etre. On dessine le panneau sur de fausses sessions et on verifie les
// contraintes de Discord — c est exactement ce qui casse au premier lancement.
{
  const { rendu, renduRedemarrage } = await import('./lib/panneau.js');
  const { AudioPlayerStatus } = await import('@discordjs/voice');

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

  // Le panneau de redemarrage : c est ce qu on laisse a l ecran en mourant.
  const adieu = renduRedemarrage();
  if (adieu.components.length) probleme('Le panneau de redemarrage garde des boutons.');
  console.log(`  Adieu     : ${adieu.embeds[0].toJSON().description}`);
}

console.log('\n── Son ' + '─'.repeat(62));
{
  const { duree } = await import('./lib/duree.js');
  const { niveau } = await import('./lib/niveau.js');
  const { rampe } = await import('./lib/musique.js');

  // Les deux sondes ffmpeg, exercees pour de vrai : c est aussi le seul test
  // de ffmpeg lui-meme qu on puisse faire hors ligne.
  if (pistes.length) {
    const p = pistes[0];
    const ms = await duree(p.chemin);
    console.log(`  Duree     : ${p.titre} — ${ms ? `${Math.round(ms / 1000)} s` : 'illisible'}`);
    if (!ms) console.log('  ℹ Sans duree : pas de barre de progression, et pas de fondu de sortie.');

    if (!config.niveauCibleDb) {
      console.log('  Niveau    : correction desactivee (NIVEAU_CIBLE_DB=0).');
    } else {
      const n = await niveau(p.chemin);
      console.log(n
        ? `  Niveau    : moyen ${n.moyen} dB · crete ${n.crete} dB `
          + `→ gain ×${n.gain.toFixed(2)} (cible ${config.niveauCibleDb} dB)`
        : '  Niveau    : illisible — la piste sera jouee telle quelle.');
    }
  } else {
    console.log('  Sondes    : aucune piste a sonder.');
  }

  // La rampe de fondu : sans connexion, c est le seul moyen de verifier qu un
  // fondu part bien de zero et arrive bien a destination.
  //
  // La minuterie du fondu est `unref` — un fondu ne doit pas retenir le
  // processus au moment de mourir. Ici, rien d autre ne tient la boucle
  // d evenements ouverte : on la tient nous-memes, le temps de la mesure.
  const tenir = setInterval(() => {}, 50);
  const pas = [];
  await rampe(0, 1, 200, (v) => pas.push(v)).promesse;
  const dernier = pas[pas.length - 1];
  if (dernier !== 1) probleme(`La rampe de fondu s arrete a ${dernier} au lieu de 1.`);
  console.log(`  Fondu     : ${config.fonduMs} ms · rampe d essai en ${pas.length} pas, `
    + `de ${pas[0]?.toFixed(2)} a ${dernier?.toFixed(2)}`);

  // Une rampe interrompue doit rendre la main, sinon un fondu annule laisserait
  // une promesse en suspens et « suivant » n avancerait plus.
  const coupee = rampe(0, 1, 5_000, () => {});
  coupee.annuler();
  await coupee.promesse;
  console.log('  Rampe     : une rampe annulee rend bien la main.');
  clearInterval(tenir);
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
