// Une seule commande : /musique ouvre un panneau, et tout le reste passe par
// ses boutons et ses menus. Les identifiants de composants sont prefixes du nom
// de la commande (« musique:… ») : c est ce qui permet a index.js d aiguiller
// un clic vers ce fichier sans table de correspondance supplementaire.
import {
  SlashCommandBuilder, InteractionContextType,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { rejoindre, session, bibliotheque, categories, MODES_BOUCLE } from '../lib/musique.js';
import { COULEURS } from '../lib/couleurs.js';
import { config } from '../config.js';
import { log } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('musique')
  .setDescription('Ouvrir le panneau des ambiances sonores')
  .setContexts(InteractionContextType.Guild);

const PAS_VOLUME = 0.1;
const pourcent = (v) => `${Math.round(v * 100)} %`;

const DIT_BOUCLE = { aucune: 'Aucune', piste: 'Piste', liste: 'Liste' };

// --- Rendu ---------------------------------------------------------------

/** Construit le panneau a partir de l etat courant. `s` peut etre null. */
function rendu(s) {
  const pistes = bibliotheque();
  const joue = Boolean(s?.courante);
  const enPause = s?.statut === AudioPlayerStatus.Paused;

  const embed = new EmbedBuilder()
    .setColor(joue ? (enPause ? COULEURS.or : COULEURS.jade) : COULEURS.encre)
    .setTitle('太白金星 — Ambiances');

  if (!pistes.length) {
    embed.setDescription(
      `Aucun fichier dans \`${config.dossierMusique}\`.\n\n` +
      'Dépose des `.mp3` ou des `.ogg` dans des sous-dossiers : ' +
      'un dossier vaut une ambiance, le nom du fichier devient le titre.'
    );
    return { embeds: [embed], components: [] };
  }

  embed.setDescription(joue
    ? `${enPause ? '⏸' : '▶'} **${s.courante.titre}**\n*${s.courante.categorie}*`
    : '*Rien en cours.*');

  embed.addFields(
    { name: 'Volume', value: pourcent(s?.volume ?? config.volumeDefaut), inline: true },
    { name: 'Boucle', value: DIT_BOUCLE[s?.boucle ?? 'aucune'], inline: true },
    { name: 'En file', value: String(s?.file.length ?? 0), inline: true },
  );

  if (s?.file.length) {
    embed.addFields({
      name: 'À suivre',
      value: s.file.slice(0, 5).map((p, i) => `${i + 1}. ${p.titre}`).join('\n')
        + (s.file.length > 5 ? `\n… et ${s.file.length - 5} autres` : ''),
    });
  }

  // Discord plafonne un menu a 25 entrees.
  const cats = categories().slice(0, 25);
  const vingtCinq = pistes.slice(0, 25);
  if (pistes.length > 25) {
    embed.setFooter({ text: `${pistes.length} pistes — le menu n en montre que 25. Passe par les ambiances.` });
  }

  const menuAmbiance = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('musique:categorie')
      .setPlaceholder('Une ambiance — tout le dossier, mélangé, en boucle')
      .addOptions(cats.map((c) => ({ label: c.slice(0, 100), value: c.slice(0, 100) }))));

  const menuPiste = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('musique:piste')
      .setPlaceholder('Une piste précise')
      .addOptions(vingtCinq.map((p) => ({
        label: p.titre.slice(0, 100),
        description: p.categorie.slice(0, 100),
        value: p.id.slice(0, 100),
      }))));

  const bouton = (id, emoji, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`musique:${id}`).setEmoji(emoji).setStyle(style).setDisabled(!s);

  const transport = new ActionRowBuilder().addComponents(
    bouton('lecture', enPause ? '▶️' : '⏸️', joue ? ButtonStyle.Primary : ButtonStyle.Secondary),
    bouton('suivant', '⏭️'),
    bouton('volume-', '🔉'),
    bouton('volume+', '🔊'),
    bouton('boucle', '🔁'),
  );

  const arret = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('musique:stop')
      .setLabel('Arrêter et quitter')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!s));

  return { embeds: [embed], components: [menuAmbiance, menuPiste, transport, arret] };
}

/** Le panneau se remet a jour quand la session change d elle-meme. */
function accrocher(s) {
  if (s.surChangement) return s;
  s.surChangement = () => {
    if (!s.panneau) return;
    s.panneau.edit(rendu(session(s.guildeId)))
      .catch((err) => { log.debug(`Panneau perdu : ${err.message}`); s.panneau = null; });
  };
  return s;
}

// --- Commande ------------------------------------------------------------

export async function execute(interaction) {
  // Rejoindre un salon vocal peut demander plusieurs secondes ; Discord n en
  // accorde que trois pour repondre. On accuse reception avant d essayer.
  await interaction.deferReply();
  const s = accrocher(await rejoindre(interaction.member, interaction.channel));
  await interaction.editReply(rendu(s));
  s.panneau = await interaction.fetchReply();
}

// --- Clics et menus ------------------------------------------------------

export async function composant(interaction) {
  const action = interaction.customId.split(':')[1];

  // Meme raison que dans execute() : un clic qui declenche une connexion vocale
  // depasserait les trois secondes accordees. deferUpdate garde le panneau tel
  // quel a l ecran pendant qu on travaille.
  await interaction.deferUpdate();

  let s = session(interaction.guildId);

  // Pendant qu on traite le clic, on coupe le rafraichissement automatique :
  // c est la reponse a l interaction qui fera l affichage, une seule fois.
  if (s) s.panneau = null;

  if (action === 'categorie' || action === 'piste') {
    s = accrocher(await rejoindre(interaction.member, interaction.channel));
    s.panneau = null;
  } else if (!s) {
    throw new Error('Je ne joue rien pour le moment. Relance `/musique`.');
  }

  switch (action) {
    case 'categorie': {
      const categorie = interaction.values[0];
      const pistes = bibliotheque({ forcer: true }).filter((p) => p.categorie === categorie);
      if (!pistes.length) throw new Error(`Le dossier « ${categorie} » est vide ou inconnu.`);
      s.vider();
      s.ajouter(pistes);
      s.melanger();
      s.boucle = 'liste';
      if (s.courante) s.suivant(); else await s.demarrer();
      break;
    }
    case 'piste': {
      const piste = bibliotheque({ forcer: true }).find((p) => p.id === interaction.values[0]);
      if (!piste) throw new Error('Cette piste a disparu de la bibliothèque.');
      s.file.unshift(piste);
      if (s.courante) s.suivant(); else await s.demarrer();
      break;
    }
    case 'lecture':
      if (s.statut === AudioPlayerStatus.Paused) s.reprendre();
      else s.pause();
      break;
    case 'suivant':
      s.suivant();
      break;
    case 'volume-':
      s.definirVolume(s.volume - PAS_VOLUME);
      break;
    case 'volume+':
      s.definirVolume(s.volume + PAS_VOLUME);
      break;
    case 'boucle':
      s.boucle = MODES_BOUCLE[(MODES_BOUCLE.indexOf(s.boucle) + 1) % MODES_BOUCLE.length];
      break;
    case 'stop':
      s.stop();
      s.detruire();
      break;
    default:
      throw new Error(`Action inconnue : ${action}`);
  }

  await interaction.editReply(rendu(session(interaction.guildId)));

  // On raccroche le panneau : la piste demandee ne demarre qu au prochain tour
  // de boucle d evenements, et c est le rafraichissement qui l affichera.
  const vivante = session(interaction.guildId);
  if (vivante) vivante.panneau = interaction.message;
}

export default { data, execute, composant };
