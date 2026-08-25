// Faire parler un PNJ sous son propre nom et son portrait, via un webhook de salon.
import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType,
  MessageFlags, PermissionFlagsBits,
} from 'discord.js';
import { pnjs } from '../lib/db.js';
import { COULEURS } from '../lib/couleurs.js';
import { log } from '../logger.js';

const NOM_WEBHOOK = 'Taibai Jinxing';
const cache = new Map(); // salonId -> webhook

// Discord refuse ces mots dans un pseudo de webhook.
const NOM_INTERDIT = /(discord|clyde)/i;

async function webhookDuSalon(interaction) {
  const salon = interaction.channel;
  const parent = salon.isThread() ? salon.parent : salon;
  if (!parent) throw new Error('Ce type de salon ne peut pas accueillir de webhook.');

  const perms = parent.permissionsFor(interaction.guild.members.me);
  if (!perms?.has(PermissionFlagsBits.ManageWebhooks)) {
    throw new Error(`Il me manque « Gerer les webhooks » dans ${parent}. C est cette permission qui donne une voix aux PNJ.`);
  }

  const enCache = cache.get(parent.id);
  if (enCache) return { webhook: enCache, threadId: salon.isThread() ? salon.id : undefined };

  const existants = await parent.fetchWebhooks();
  let webhook = existants.find((w) => w.owner?.id === interaction.client.user.id && w.name === NOM_WEBHOOK);
  if (!webhook) {
    webhook = await parent.createWebhook({
      name: NOM_WEBHOOK,
      reason: 'Voix des personnages non joueurs',
    });
    log.info(`Webhook cree dans #${parent.name}`);
  }

  cache.set(parent.id, webhook);
  return { webhook, threadId: salon.isThread() ? salon.id : undefined };
}

const cle = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const urlValide = (u) => !u || /^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(u);

export const data = new SlashCommandBuilder()
  .setName('voix')
  .setDescription('Donner la parole a un personnage non joueur')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s
    .setName('dire')
    .setDescription('Faire parler un PNJ dans ce salon')
    .addStringOption((o) => o
      .setName('qui')
      .setDescription('Un PNJ enregistre, ou un nom libre')
      .setRequired(true)
      .setAutocomplete(true)
      .setMaxLength(80))
    .addStringOption((o) => o
      .setName('message')
      .setDescription('Ce qu il dit')
      .setRequired(true)
      .setMaxLength(2000))
    .addStringOption((o) => o
      .setName('portrait')
      .setDescription('URL d image, si le PNJ n est pas enregistre')))
  .addSubcommand((s) => s
    .setName('enregistrer')
    .setDescription('Retenir un PNJ, son nom et son portrait')
    .addStringOption((o) => o
      .setName('nom').setDescription('Nom affiche').setRequired(true).setMaxLength(80))
    .addStringOption((o) => o
      .setName('portrait').setDescription('URL d image (png, jpg, gif, webp)')))
  .addSubcommand((s) => s.setName('liste').setDescription('Les PNJ enregistres sur ce serveur'))
  .addSubcommand((s) => s
    .setName('oublier')
    .setDescription('Retirer un PNJ enregistre')
    .addStringOption((o) => o
      .setName('qui').setDescription('Le PNJ a oublier').setRequired(true).setAutocomplete(true)));

export async function autocomplete(interaction) {
  const saisie = (interaction.options.getFocused() ?? '').toLowerCase();
  const trouves = pnjs.liste(interaction.guildId)
    .filter((p) => p.nom.toLowerCase().includes(saisie))
    .slice(0, 25);
  return interaction.respond(trouves.map((p) => ({ name: p.nom.slice(0, 100), value: p.cle })));
}

export async function execute(interaction) {
  const guilde = interaction.guildId;
  const sous = interaction.options.getSubcommand();

  if (sous === 'enregistrer') {
    const nom = interaction.options.getString('nom', true).trim();
    const portrait = interaction.options.getString('portrait');
    if (NOM_INTERDIT.test(nom)) throw new Error('Discord refuse ce nom (il contient « discord » ou « clyde »).');
    if (!urlValide(portrait)) throw new Error('Le portrait doit etre une URL https vers une image.');

    const p = pnjs.enregistrer(guilde, cle(nom), nom, portrait, interaction.user.id);
    return interaction.reply({
      content: `**${p.nom}** est enregistre. Appelle-le avec \`/voix dire\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sous === 'liste') {
    const tous = pnjs.liste(guilde);
    if (!tous.length) throw new Error('Aucun PNJ enregistre. Vois `/voix enregistrer`.');
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COULEURS.encre)
        .setTitle(`Personnages non joueurs (${tous.length})`)
        .setDescription(tous.map((p) => `· **${p.nom}**${p.avatar ? ' 🖼' : ''}`).join('\n').slice(0, 4000))],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sous === 'oublier') {
    const identifiant = interaction.options.getString('qui', true);
    const trouve = pnjs.lire(guilde, identifiant) ?? pnjs.lire(guilde, cle(identifiant));
    if (!trouve || !pnjs.supprimer(guilde, trouve.cle)) throw new Error('Ce PNJ ne figure pas dans mes registres.');
    return interaction.reply({ content: `**${trouve.nom}** est oublie.`, flags: MessageFlags.Ephemeral });
  }

  // --- dire ---
  const demande = interaction.options.getString('qui', true).trim();
  const message = interaction.options.getString('message', true);
  const portraitLibre = interaction.options.getString('portrait');

  const connu = pnjs.lire(guilde, demande) ?? pnjs.lire(guilde, cle(demande));
  const nom = (connu?.nom ?? demande).slice(0, 80);
  const portrait = portraitLibre ?? connu?.avatar ?? null;

  if (NOM_INTERDIT.test(nom)) throw new Error('Discord refuse ce nom (il contient « discord » ou « clyde »).');
  if (!urlValide(portraitLibre)) throw new Error('Le portrait doit etre une URL https vers une image.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let envoi;
  try {
    const { webhook, threadId } = await webhookDuSalon(interaction);
    envoi = await webhook.send({
      content: message,
      username: nom,
      avatarURL: portrait ?? undefined,
      threadId,
      // Le PNJ ne doit pas pouvoir sonner tout le serveur.
      allowedMentions: { parse: ['users'] },
    });
  } catch (err) {
    if (err.code === 10015) { // webhook supprime entre-temps
      cache.delete(interaction.channel.isThread() ? interaction.channel.parentId : interaction.channelId);
      throw new Error('Le webhook avait disparu. Relance la commande.');
    }
    throw err;
  }

  return interaction.editReply(`Dit. → ${envoi.url ?? ''}`);
}

export default { data, execute, autocomplete };
