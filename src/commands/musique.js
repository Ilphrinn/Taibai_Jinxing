// Une seule commande : /musique ouvre un panneau, et tout le reste passe par
// ses boutons et ses menus. Les identifiants de composants sont prefixes du nom
// de la commande (« musique:… ») : c est ce qui permet a index.js d aiguiller
// un clic vers ce fichier sans table de correspondance supplementaire.
//
// Le dessin du panneau est dans lib/panneau.js ; ici, l aiguillage et les actions.
import { SlashCommandBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { rejoindre, session, bibliotheque, MODES_BOUCLE } from '../lib/musique.js';
import {
  poser, oublier, selection, majeureSuivante, pistesDeLaSelection, TOUS,
} from '../lib/navigation.js';
import { rendu, oublierPochette } from '../lib/panneau.js';
import { config } from '../config.js';
import { log } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('musique')
  .setDescription('Ouvrir le panneau des ambiances sonores')
  .setContexts(InteractionContextType.Guild);

const PAS_VOLUME = 0.1;

// Les deux seules actions qui demandent le salon vocal : elles lancent du son.
const REJOINT = new Set(['jouer', 'piste']);

// Feuilleter la bibliotheque n exige rien — ni session, ni vocal. C est le
// point de la navigation : on regarde ce qu on a avant de faire venir le bot.
const NAVIGATION = new Set(['lieu', 'majeure', 'page-', 'page+']);

// --- Rafraichissement automatique ----------------------------------------

// La barre de progression n avance que si quelqu un redessine le panneau.
// Une minuterie par serveur, et rien de plus : pas de duree connue ou pas de
// lecture en cours, on ne depense pas une requete pour un affichage identique.
const minuteries = new Map();

function desarmer(guildeId) {
  const m = minuteries.get(guildeId);
  if (m) { clearInterval(m); minuteries.delete(guildeId); }
}

function armer(guildeId) {
  if (config.panneauMs <= 0 || minuteries.has(guildeId)) return;
  const m = setInterval(() => {
    const s = session(guildeId);
    if (!s || !s.panneau) { desarmer(guildeId); return; }
    if (s.statut !== AudioPlayerStatus.Playing) return;
    if (!s.courante?.duree) return;
    s.panneau.edit(rendu(s, s.panneau.guild))
      .catch((err) => {
        log.debug(`Panneau perdu : ${err.message}`);
        s.panneau = null;
        desarmer(guildeId);
      });
  }, config.panneauMs);
  m.unref?.();
  minuteries.set(guildeId, m);
}

/** Le panneau se remet a jour quand la session change d elle-meme. */
function accrocher(s) {
  if (s.surChangement) return s;
  s.surChangement = () => {
    // detruire() previent en dernier, la session deja retiree : c est le moment
    // d arreter la minuterie plutot que d attendre qu elle le constate.
    const vivante = session(s.guildeId);
    if (!vivante) desarmer(s.guildeId);
    if (!s.panneau) return;
    s.panneau.edit(rendu(vivante, s.panneau.guild))
      .catch((err) => { log.debug(`Panneau perdu : ${err.message}`); s.panneau = null; });
  };
  return s;
}

// --- Commande ------------------------------------------------------------

export async function execute(interaction) {
  // Rejoindre un salon vocal peut demander plusieurs secondes ; Discord n en
  // accorde que trois pour repondre. On accuse reception avant d essayer.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const s = accrocher(await rejoindre(interaction.member, interaction.channel));

  // Un panneau deja pose dans ce salon est repris tel quel : inutile d en
  // empiler un deuxieme, et l ancien deviendrait inerte sans le dire.
  if (s.panneau && s.panneau.channelId === interaction.channelId) {
    await s.panneau.edit(rendu(s, interaction.guild)).catch(() => { s.panneau = null; });
    if (s.panneau) {
      armer(s.guildeId);
      await interaction.editReply(`Le panneau est déjà ouvert : ${s.panneau.url}`);
      return;
    }
  }

  // Le panneau doit vivre toute la seance. Une reponse d interaction ne le
  // peut pas : son jeton expire au bout de quinze minutes et chaque edition
  // echouerait ensuite en silence. On poste donc un message ordinaire, qui
  // s edite sans limite de duree.
  oublierPochette(s.guildeId);
  oublier(s.guildeId); // un panneau neuf repart en haut de la bibliotheque
  s.panneau = await interaction.channel.send(rendu(s, interaction.guild));
  armer(s.guildeId);
  await interaction.editReply('Panneau ouvert plus bas dans le salon.');
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

  if (REJOINT.has(action)) {
    s = accrocher(await rejoindre(interaction.member, interaction.channel));
    s.panneau = null;
  } else if (!s && !NAVIGATION.has(action)) {
    throw new Error('Je ne joue rien pour le moment. Relance `/musique`.');
  }

  switch (action) {
    // --- Navigation : on feuillette, on ne joue rien ----------------------
    case 'lieu':
      poser(interaction.guildId, { lieu: interaction.values[0], page: 0 });
      break;
    case 'majeure':
      poser(interaction.guildId, {
        majeure: majeureSuivante(interaction.guildId), lieu: TOUS, page: 0,
      });
      break;
    case 'page-':
      poser(interaction.guildId, { page: selection(interaction.guildId).page - 1 });
      break;
    case 'page+':
      poser(interaction.guildId, { page: selection(interaction.guildId).page + 1 });
      break;

    // --- Lecture ----------------------------------------------------------
    case 'jouer': {
      bibliotheque({ forcer: true });
      const pistes = pistesDeLaSelection(interaction.guildId);
      if (!pistes.length) throw new Error('Il n y a rien à jouer ici.');
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
      s.prioriser(piste);
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
    case 'melanger':
      if (!s.file.length) throw new Error('La file est vide : il n y a rien à mélanger.');
      s.melanger();
      break;
    case 'stop':
      s.stop();
      s.detruire();
      desarmer(interaction.guildId);
      break;
    default:
      throw new Error(`Action inconnue : ${action}`);
  }

  await interaction.editReply(rendu(session(interaction.guildId), interaction.guild));

  // On raccroche le panneau : la piste demandee ne demarre qu au prochain tour
  // de boucle d evenements, et c est le rafraichissement qui l affichera.
  const vivante = session(interaction.guildId);
  if (vivante) {
    vivante.panneau = interaction.message;
    armer(interaction.guildId);
  }
}

export default { data, execute, composant };
