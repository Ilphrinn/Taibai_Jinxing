// Enregistre les commandes aupres de Discord.
//   npm run commandes         -> sur le serveur de test si DISCORD_GUILD_ID est defini, sinon partout
//   npm run commandes:purge   -> retire toutes les commandes du perimetre concerne
import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { log } from './logger.js';
import { commandesJSON } from './lib/chargeur.js';

const purge = process.argv.includes('--purge');
const global = process.argv.includes('--global') || !config.guildeId;

const rest = new REST({ version: '10' }).setToken(config.jeton);
const route = global
  ? Routes.applicationCommands(config.applicationId)
  : Routes.applicationGuildCommands(config.applicationId, config.guildeId);
const perimetre = global ? 'globalement' : `sur le serveur ${config.guildeId}`;

try {
  const corps = purge ? [] : await commandesJSON();
  const resultat = await rest.put(route, { body: corps });

  if (purge) log.ok(`Commandes retirees ${perimetre}.`);
  else {
    log.ok(`${resultat.length} commandes enregistrees ${perimetre} :`);
    for (const c of resultat) log.info(`  /${c.name} — ${c.description}`);
    if (global) log.warn('Deploiement global : jusqu a une heure de propagation.');
    else log.info('Deploiement de serveur : effectif immediatement.');
  }
} catch (err) {
  if (err.code === 50001) log.error('Acces manquant : le bot est-il bien sur ce serveur ?');
  else if (err.status === 401) log.error('Jeton refuse : verifie DISCORD_TOKEN.');
  else log.error(err.message ?? err);
  process.exit(1);
}
