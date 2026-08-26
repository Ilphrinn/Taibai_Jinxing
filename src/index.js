// Taibai Jinxing — point d entree.
import { Client, GatewayIntentBits, Events, ActivityType, MessageFlags } from 'discord.js';
import { generateDependencyReport } from '@discordjs/voice';
import { createRequire } from 'node:module';
import { config } from './config.js';
import { log } from './logger.js';
import { chargerCommandes } from './lib/chargeur.js';
import { toutQuitter, surChangementVocal, bibliotheque } from './lib/musique.js';

// Le chiffrement vocal doit etre pret avant toute connexion audio.
// L entree ESM de libsodium-wrappers est cassee en amont : son
// dist/modules-esm/libsodium-wrappers.mjs importe « ./libsodium.mjs », un
// fichier qui appartient au paquet voisin « libsodium » et qu il ne livre pas.
// On charge donc la version CommonJS, qui resout le paquet correctement.
// Ne remplace pas ceci par « import sodium from 'libsodium-wrappers' » : le
// bot ne demarrerait plus. Verifie d abord que l amont a corrige son paquet.
const sodium = createRequire(import.meta.url)('libsodium-wrappers');
await sodium.ready;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,        // salons, commandes, webhooks
    GatewayIntentBits.GuildVoiceStates, // savoir qui est dans quel salon vocal
  ],
  // Aucun intent privilegie : rien a activer dans le portail developpeur.
});

client.commandes = await chargerCommandes();

client.once(Events.ClientReady, (c) => {
  log.ok(`Connecte comme ${c.user.tag} (${c.user.id})`);
  log.info(`Serveurs : ${c.guilds.cache.size} · Pistes en bibliotheque : ${bibliotheque({ forcer: true }).length}`);
  c.user.setPresence({
    activities: [{ name: 'les registres du Ciel', type: ActivityType.Watching }],
    status: 'online',
  });
});

client.on(Events.VoiceStateUpdate, (ancien, nouveau) => {
  try { surChangementVocal(ancien, nouveau); }
  catch (err) { log.error('VoiceStateUpdate :', err.message); }
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Un composant porte son aiguillage dans son identifiant : « musique:stop »
  // designe la commande « musique ». Aucune table a tenir a jour en plus.
  const estComposant = interaction.isButton() || interaction.isAnySelectMenu();
  const nom = estComposant ? interaction.customId.split(':')[0] : interaction.commandName;

  const commande = client.commandes.get(nom);
  if (!commande) return;

  if (interaction.isAutocomplete()) {
    try { await commande.autocomplete?.(interaction); }
    catch (err) { log.error(`Autocompletion ${nom} :`, err.message); }
    return;
  }

  if (!estComposant && !interaction.isChatInputCommand()) return;

  try {
    if (estComposant) await commande.composant?.(interaction);
    else await commande.execute(interaction);
  } catch (err) {
    log.error(`${estComposant ? 'Composant' : 'Commande'} ${nom} :`, err);
    const message = {
      content: `⚠️ ${err.message ?? 'Quelque chose a echoue.'}`,
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(message);
      else await interaction.reply(message);
    } catch { /* interaction expiree : rien a faire */ }
  }
});

client.on(Events.Error, (err) => log.error('Client :', err.message));
client.on(Events.Warn, (msg) => log.warn(msg));

process.on('unhandledRejection', (err) => log.error('Promesse rejetee :', err));
process.on('uncaughtException', (err) => {
  log.error('Exception non capturee :', err);
  arreter('uncaughtException', 1);
});

let arretEnCours = false;
function arreter(signal, code = 0) {
  if (arretEnCours) return;
  arretEnCours = true;
  log.info(`Arret (${signal})...`);
  toutQuitter();
  client.destroy().finally(() => process.exit(code));
  setTimeout(() => process.exit(code), 5_000).unref();
}

// Railway envoie SIGTERM avant chaque redeploiement : on quitte proprement les salons vocaux.
process.on('SIGTERM', () => arreter('SIGTERM'));
process.on('SIGINT', () => arreter('SIGINT'));

if (config.journalNiveau === 'debug') log.debug(generateDependencyReport());

await client.login(config.jeton);
