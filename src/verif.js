// Diagnostic hors ligne : ne se connecte a rien, ne demande pas de jeton valide.
//   npm run verif
process.env.DISCORD_TOKEN ||= 'verification-hors-ligne';
process.env.DISCORD_APPLICATION_ID ||= '000000000000000000';

const { chargerCommandes } = await import('./lib/chargeur.js');
const { generateDependencyReport } = await import('@discordjs/voice');
const { bibliotheque, categories } = await import('./lib/musique.js');
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
console.log(`  Categories: ${categories().join(', ') || '(aucune)'}`);
if (!pistes.length) console.log('  ℹ Aucun fichier : depose des .mp3 ou .ogg dans des sous-dossiers.');

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

console.log('\n' + '─'.repeat(69));
console.log(soucis ? `  ${soucis} probleme(s) a regler.\n` : '  Tout est en ordre.\n');
process.exit(soucis ? 1 : 0);
