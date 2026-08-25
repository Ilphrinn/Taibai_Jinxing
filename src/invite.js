// Construit le lien d invitation du bot.
//   npm run lien                  (lit DISCORD_APPLICATION_ID dans .env)
//   node src/invite.js 123456789  (identifiant passe en argument)
// Volontairement independant de config.js : utilisable avant meme d avoir un jeton.
import 'dotenv/config';
import { PERMISSIONS, MINIMALES, bitfield, lienInvitation } from './lib/permissions.js';

const id = (process.argv[2] || process.env.DISCORD_APPLICATION_ID || '').trim();

if (!/^\d{17,20}$/.test(id)) {
  console.error(
    '\n  Identifiant d application manquant ou invalide.\n' +
    '  Portail developpeur > ton application > General Information > Application ID.\n\n' +
    '  Usage : node src/invite.js <APPLICATION_ID>\n' +
    '  ou renseigne DISCORD_APPLICATION_ID dans .env\n'
  );
  process.exit(1);
}

const largeur = Math.max(...PERMISSIONS.map(([, libelle]) => libelle.length));

console.log('\n  Permissions demandees\n  ' + '─'.repeat(largeur + 40));
for (const [, libelle, raison] of PERMISSIONS) {
  console.log(`  ${libelle.padEnd(largeur)}  ${raison}`);
}

console.log(`\n  Total (bitfield) : ${bitfield()}`);
console.log('\n  ── Lien complet ' + '─'.repeat(50));
console.log(`\n  ${lienInvitation(id)}\n`);
console.log('  ── Lien minimal (des + oracle + musique, sans outils de MJ) ' + '─'.repeat(6));
console.log(`\n  ${lienInvitation(id, MINIMALES)}\n`);
console.log('  Ouvre le lien, choisis ton serveur, autorise. Il faut y etre administrateur.\n');
