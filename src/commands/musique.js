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
import { rendu, renduRedemarrage, oublierPochette } from '../lib/panneau.js';
import { config } from '../config.js';
import { log } from '../logger.js';

export const data = new SlashCommandBuilder()
  .setName('musique')
  .setDescription('Ouvrir le panneau des ambiances sonores')
  .setContexts(InteractionContextType.Guild);

const PAS_VOLUME = 0.1;

// Les deux seules actions qui demandent le salon vocal : elles lancent du son.
const REJOINT = new Set(['jouer', 'piste']);

// Feuilleter la bibliotheque n exige rien — ni session, ni vocal, ni d etre le
// maitre du panneau. C est le point de la navigation : n importe qui peut
// regarder ce qu on a sans toucher a ce qui joue.
const NAVIGATION = new Set(['lieu', 'majeure', 'page-', 'page+']);

// --- Le panneau ----------------------------------------------------------

// Le panneau ne peut PAS vivre dans la session : il doit pouvoir etre ouvert
// sans salon vocal, et la session est detruite des que le salon se vide — ce
// qui laisserait un panneau a l ecran que plus rien ne pourrait rafraichir.
// Meme patron que la vue de navigation : une Map de module, cle guildeId.
//
//   guildeId -> { message, maitre }
//
// `maitre` est celui qui a lance /musique : lui seul commande la lecture.
const panneaux = new Map();

// Pendant le traitement d un clic, on fait taire le rafraichissement
// automatique : c est la reponse a l interaction qui affichera, une seule fois.
const muets = new Set();

const messagePanneau = (guildeId) => panneaux.get(guildeId)?.message ?? null;

/**
 * Reprendre la main sur un panneau tenu par quelqu un d autre n est possible
 * que si son maitre a quitte : sans cette echappatoire, sa deconnexion
 * bloquerait la musique jusqu au redemarrage du bot.
 */
function peutReprendre(guildeId, utilisateurId, guilde) {
  const p = panneaux.get(guildeId);
  if (!p || p.maitre === utilisateurId) return true;
  const s = session(guildeId);
  if (!s) return true;
  const salon = guilde?.channels.cache.get(s.salonVocalId);
  return !salon?.members.has(p.maitre);
}

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
    const message = messagePanneau(guildeId);
    const s = session(guildeId);
    if (!s || !message) { desarmer(guildeId); return; }
    if (muets.has(guildeId)) return;
    if (s.statut !== AudioPlayerStatus.Playing) return;
    if (!s.courante?.duree) return;
    message.edit(rendu(s, message.guild))
      .catch((err) => {
        log.debug(`Panneau perdu : ${err.message}`);
        panneaux.delete(guildeId);
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
    if (muets.has(s.guildeId)) return;
    const message = messagePanneau(s.guildeId);
    if (!message) return;
    message.edit(rendu(vivante, message.guild))
      .catch((err) => {
        log.debug(`Panneau perdu : ${err.message}`);
        panneaux.delete(s.guildeId);
      });
  };
  return s;
}

/**
 * Pose le panneau la ou on le verra. Un panneau enterre sous deux heures de
 * conversation ne sert a rien : s il n est plus le dernier message du salon,
 * on en poste un neuf et on efface l ancien. Un bot supprime ses propres
 * messages sans « Gerer les messages » — la liste des permissions ne bouge pas.
 */
async function placer(interaction, s) {
  const guildeId = interaction.guildId;
  const ancien = messagePanneau(guildeId);

  if (ancien && ancien.channelId === interaction.channelId) {
    const dernier = (await interaction.channel.messages.fetch({ limit: 1 })
      .catch(() => null))?.first();
    if (dernier?.id === ancien.id) {
      const garde = await ancien.edit(rendu(s, interaction.guild))
        .then(() => true).catch(() => false);
      if (garde) return { message: ancien, replace: true };
    }
  }

  // Un panneau neuf n herite ni de la pochette deja televersee, ni — s il n y
  // en avait aucun — de la page ou l on en etait.
  oublierPochette(guildeId);
  if (!ancien) oublier(guildeId);

  const neuf = await interaction.channel.send(rendu(s, interaction.guild));
  if (ancien) ancien.delete().catch(() => { /* deja efface a la main */ });
  return { message: neuf, replace: false };
}

// --- Commande ------------------------------------------------------------

export async function execute(interaction) {
  // Rejoindre un salon vocal peut demander plusieurs secondes ; Discord n en
  // accorde que trois pour repondre. On accuse reception avant d essayer.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildeId = interaction.guildId;
  if (!peutReprendre(guildeId, interaction.user.id, interaction.guild)) {
    const p = panneaux.get(guildeId);
    await interaction.editReply(
      `Le panneau est tenu par <@${p.maitre}> : ${p.message.url}`
    );
    return;
  }

  // Le salon vocal n est PAS exige : on doit pouvoir feuilleter la
  // bibliotheque avant de faire venir le bot. Sans vocal, le panneau se pose
  // quand meme — la navigation vit, le transport est grise.
  let s = session(guildeId);
  let empeche = null;
  if (interaction.member.voice?.channel) {
    // Une permission manquante sur le salon vocal ne doit pas non plus priver
    // du panneau : on le pose, et on dit ce qui a empeche d entrer.
    try { s = accrocher(await rejoindre(interaction.member, interaction.channel)); }
    catch (err) { empeche = err.message; }
  }

  // Le panneau doit vivre toute la seance. Une reponse d interaction ne le
  // peut pas : son jeton expire au bout de quinze minutes et chaque edition
  // echouerait ensuite en silence. On poste donc un message ordinaire, qui
  // s edite sans limite de duree.
  const { message, replace } = await placer(interaction, s);
  panneaux.set(guildeId, { message, maitre: interaction.user.id });
  if (s) armer(guildeId);

  const pose = replace
    ? 'Le panneau est déjà en bas du salon.'
    : 'Panneau ouvert plus bas dans le salon.';
  await interaction.editReply(
    empeche ? `${pose}\n⚠️ ${empeche}`
      : s ? pose
        : `${pose} Rejoins un salon vocal pour lancer la musique.`
  );
}

// --- Clics et menus ------------------------------------------------------

export async function composant(interaction) {
  const action = interaction.customId.split(':')[1];
  const guildeId = interaction.guildId;

  // Meme raison que dans execute() : un clic qui declenche une connexion vocale
  // depasserait les trois secondes accordees. deferUpdate garde le panneau tel
  // quel a l ecran pendant qu on travaille.
  await interaction.deferUpdate();

  // La lecture appartient a celui qui a ouvert le panneau ; la navigation est
  // a tout le monde. Un panneau dont on ne connait plus le maitre — laisse par
  // un lancement precedent du bot — n appartient a personne.
  const tenu = panneaux.get(guildeId);
  if (!NAVIGATION.has(action) && tenu && tenu.maitre !== interaction.user.id) {
    throw new Error(`Ce panneau est tenu par <@${tenu.maitre}>.`);
  }

  let s = session(guildeId);
  muets.add(guildeId);

  try {
    if (REJOINT.has(action)) {
      s = accrocher(await rejoindre(interaction.member, interaction.channel));
    } else if (!s && !NAVIGATION.has(action)) {
      throw new Error('Je ne joue rien pour le moment. Relance `/musique`.');
    }

    switch (action) {
      // --- Navigation : on feuillette, on ne joue rien --------------------
      case 'lieu':
        poser(guildeId, { lieu: interaction.values[0], page: 0 });
        break;
      case 'majeure':
        poser(guildeId, { majeure: majeureSuivante(guildeId), lieu: TOUS, page: 0 });
        break;
      case 'page-':
        poser(guildeId, { page: selection(guildeId).page - 1 });
        break;
      case 'page+':
        poser(guildeId, { page: selection(guildeId).page + 1 });
        break;

      // --- Lecture --------------------------------------------------------
      case 'jouer': {
        bibliotheque({ forcer: true });
        const pistes = pistesDeLaSelection(guildeId);
        if (!pistes.length) throw new Error('Il n y a rien à jouer ici.');
        s.vider();
        s.ajouter(pistes);
        s.melanger();
        s.boucle = 'liste';
        if (s.courante) await s.suivant(); else await s.demarrer();
        break;
      }
      case 'piste': {
        const piste = bibliotheque({ forcer: true }).find((p) => p.id === interaction.values[0]);
        if (!piste) throw new Error('Cette piste a disparu de la bibliothèque.');
        s.prioriser(piste);
        if (s.courante) await s.suivant(); else await s.demarrer();
        break;
      }
      case 'lecture':
        if (s.statut === AudioPlayerStatus.Paused) s.reprendre();
        else s.pause();
        break;
      case 'suivant':
        await s.suivant();
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
        await s.stop();
        s.detruire();
        desarmer(guildeId);
        break;
      default:
        throw new Error(`Action inconnue : ${action}`);
    }
  } finally {
    muets.delete(guildeId);
  }

  await interaction.editReply(rendu(session(guildeId), interaction.guild));

  // Le clic peut venir d un panneau plus ancien que celui qu on suivait : c est
  // celui-la que voit le joueur, donc c est celui-la qu on suit desormais.
  panneaux.set(guildeId, {
    message: interaction.message,
    maitre: tenu?.maitre ?? interaction.user.id,
  });

  // La piste demandee ne demarre qu au prochain tour de boucle d evenements :
  // c est le rafraichissement automatique qui l affichera.
  if (session(guildeId)) armer(guildeId);
}

// --- Arret ---------------------------------------------------------------

/**
 * Appelee par index.js avant que le processus ne meure. Un redeploiement
 * laisserait sinon un panneau fige sur « En lecture », avec des boutons qui
 * repondraient « Je ne joue rien ». On le remplace par un mot honnete, sans
 * boutons. Un SIGKILL, lui, laisse le fantome : on ne peut rien y faire sans
 * persistance, et il n y a pas de base.
 */
export async function arret() {
  const messages = [...panneaux.values()].map((p) => p.message);
  panneaux.clear();
  for (const guildeId of [...minuteries.keys()]) desarmer(guildeId);
  await Promise.allSettled(
    messages.map((m) => m.edit(renduRedemarrage()).catch(() => {}))
  );
}

export default { data, execute, composant, arret };
