// Premier contact reseau : verifie le jeton, l identite de l application et la
// presence du bot sur le serveur de jeu. Trois requetes, aucune ecriture.
//   npm run connexion
// A lancer avant « npm run commandes » : c est ce qui separe « jeton refuse »
// de « mauvais identifiant d application » et de « bot pas encore invite ».
import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { log } from './logger.js';

const rest = new REST({ version: '10' }).setToken(config.jeton);

let soucis = 0;
const probleme = (m) => { log.error(m); soucis++; };

// --- 1. Le jeton est-il valide ? -----------------------------------------

let bot;
try {
  bot = await rest.get(Routes.user('@me'));
} catch (err) {
  if (err.status === 401) {
    log.error('Jeton refuse par Discord.');
    log.info('  Portail developpeur > ton application > Bot > Reset Token.');
    log.info('  Colle le jeton seul dans DISCORD_TOKEN : sans guillemets, sans prefixe « Bot ».');
  } else {
    log.error(`Discord a repondu ${err.status ?? '?'} : ${err.message}`);
  }
  process.exit(1);
}

log.ok(`Jeton valide — ${bot.username}#${bot.discriminator} (${bot.id})`);

// --- 2. L identifiant d application correspond-il au jeton ? -------------

const application = await rest.get(Routes.currentApplication());

if (application.id !== config.applicationId) {
  probleme('DISCORD_APPLICATION_ID ne correspond pas au jeton.');
  log.info(`  Dans .env      : ${config.applicationId}`);
  log.info(`  D apres Discord: ${application.id}  (« ${application.name} »)`);
  log.info('  Corrige .env, sinon les commandes seront declarees sur une autre application');
  log.info('  et n apparaitront jamais dans ton serveur.');
} else {
  log.ok(`Application « ${application.name} » — identifiant conforme.`);
}

// --- 3. Le bot est-il sur le serveur de jeu ? ----------------------------

const guildes = await rest.get(Routes.userGuilds());

if (!config.guildeId) {
  log.warn('DISCORD_GUILD_ID est vide : les commandes seront declarees globalement');
  log.info('  (jusqu a une heure de propagation). Renseigne-le pendant la mise au point.');
  log.info(`  Serveurs connus : ${guildes.map((g) => g.name).join(', ') || '(aucun)'}`);
} else {
  const guilde = guildes.find((g) => g.id === config.guildeId);
  if (guilde) log.ok(`Present sur « ${guilde.name} » (${guilde.id}).`);
  else {
    probleme(`Le bot n est pas sur le serveur ${config.guildeId}.`);
    log.info('  Lance « npm run lien », ouvre le lien complet, autorise, puis reessaie.');
    if (guildes.length) log.info(`  Il est en revanche sur : ${guildes.map((g) => g.name).join(', ')}`);
  }
}

console.log('');
if (soucis) {
  log.error(`${soucis} probleme(s) a regler avant « npm run commandes ».`);
  process.exit(1);
}
log.ok('Tout est en ordre. Suite : npm run commandes, puis npm start.');
