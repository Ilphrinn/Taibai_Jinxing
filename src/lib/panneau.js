// Le dessin du panneau de /musique, et rien d autre : la commande garde
// l aiguillage et les actions, ce fichier garde l affichage.
//
// Tout se dessine en caracteres. Discord n a pas de barre de progression, mais
// les blocs pleins et vides en tiennent lieu, et ils ont l avantage de se
// rafraichir pour le prix d une edition de message — la ou une image demanderait
// un nouveau televersement toutes les dix secondes.
import fs from 'node:fs';
import path from 'node:path';
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, AttachmentBuilder,
} from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { bibliotheque } from './musique.js';
import { selection, PAR_PAGE, TOUS, PARTOUT } from './navigation.js';
import { nomLieu, nomMajeure, iconeMajeure } from './lieux.js';
import { dureeConnue } from './duree.js';
import { COULEURS } from './couleurs.js';
import { config } from '../config.js';

// --- Reglages d affichage ------------------------------------------------

const LARGEUR_PROGRESSION = 16;
const LARGEUR_VOLUME = 10;

// definirVolume() borne le volume a 2. La jauge couvre donc toute l echelle,
// ce qui la rend grossiere en bas (35 % = 2 blocs sur 10) : le pourcentage
// exact reste ecrit a cote. Descendre a 1 si Ilphrinn prefere la finesse a
// l honnetete de l echelle.
const VOLUME_MAX = 2;

const PLEIN = '▰';
const VIDE = '▱';

// Discord plafonne un menu deroulant a 25 entrees.
const MAX_OPTIONS = 25;

// Une file plus longue que ca ne se lit plus : on annonce le reste en un mot.
const MAX_A_SUIVRE = 5;

const DIT_BOUCLE = { aucune: 'Aucune', piste: 'Piste', liste: 'Liste' };
const ICONE_BOUCLE = { aucune: '➡️', piste: '🔂', liste: '🔁' };

const IMAGES = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const NOMS_POCHETTE = ['pochette', 'cover', 'illustration'];

// --- Petits outils -------------------------------------------------------

function jauge(part, largeur) {
  const n = Math.max(0, Math.min(largeur, Math.round(part * largeur)));
  return PLEIN.repeat(n) + VIDE.repeat(largeur - n);
}

/** m:ss, et h:mm:ss au-dela de l heure. */
function temps(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  const s = t % 60, m = Math.floor(t / 60) % 60, h = Math.floor(t / 3600);
  const deux = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`;
}

const pourcent = (v) => `${Math.round(v * 100)} %`;

// Meme convention que pour les des : on cherche l emoji du serveur par NOM,
// insensible a la casse. Un emoji nomme « combat » illustre le dossier
// « combat ». Absent, on n en parle pas. Voir lib/commande-des.js.
function emoji(guilde, nom) {
  if (!nom) return null;
  const cherche = nom.toLowerCase();
  return guilde?.emojis.cache.find((e) => e.name.toLowerCase() === cherche)?.toString() ?? null;
}

// --- Pochettes -----------------------------------------------------------

function trouverImage(dossier, bases) {
  for (const base of bases) {
    for (const ext of IMAGES) {
      const essai = path.join(dossier, base + ext);
      try { if (fs.statSync(essai).isFile()) return essai; } catch { /* suivant */ }
    }
  }
  return null;
}

/**
 * L illustration d une piste : une image portant son nom l emporte sur celle
 * de son lieu, qui l emporte sur celle de sa majeure, qui l emporte sur celle
 * posee a la racine. On remonte donc les dossiers un a un — c est ce qui permet
 * une pochette par region sans en poser une par fichier.
 */
function pochetteDe(piste) {
  if (!piste?.chemin) return null;

  let dossier = path.dirname(piste.chemin);
  const nu = path.basename(piste.fichier, path.extname(piste.fichier));
  const propre = trouverImage(dossier, [nu]);
  if (propre) return propre;

  const racine = path.resolve(config.dossierMusique);
  for (let palier = 0; palier < 4; palier++) {
    const trouvee = trouverImage(dossier, NOMS_POCHETTE);
    if (trouvee) return trouvee;
    if (path.resolve(dossier) === racine) break;
    const parent = path.dirname(dossier);
    if (parent === dossier) break;
    dossier = parent;
  }
  return null;
}

// Quelle pochette est deja televersee sur le panneau de quel serveur. Sans
// cette memoire, chaque rafraichissement renverrait la meme image — soit six
// fois par minute pendant toute une seance.
const posees = new Map();

/** A appeler quand on poste un panneau neuf : l ancien emportait sa piece jointe. */
export function oublierPochette(guildeId) { posees.delete(guildeId); }

// --- Rendu ---------------------------------------------------------------

/** L etat du lecteur, dit sans mentir. */
function etat(s) {
  if (!s?.courante) return null;
  switch (s.statut) {
    case AudioPlayerStatus.Paused: return { icone: '⏸', mot: 'En pause', couleur: COULEURS.or };
    // Personne dans le salon : le lecteur s est mis en veille tout seul
    // (NoSubscriberBehavior.Pause). L annoncer comme une pause volontaire
    // laisserait chercher qui a clique.
    case AudioPlayerStatus.AutoPaused:
      return { icone: '💤', mot: 'En veille — personne n\'écoute', couleur: COULEURS.encre };
    default: return { icone: '▶️', mot: 'En lecture', couleur: COULEURS.jade };
  }
}

function ligneProgression(s) {
  const totale = s.courante?.duree ?? dureeConnue(s.courante.chemin);
  const position = s.position ?? 0;
  // Duree inconnue (fichier exotique, ffmpeg muet) : on montre le temps ecoule
  // sans pretendre savoir ou on en est.
  if (!totale) return `${temps(position)} écoulées`;
  return `${jauge(Math.min(1, position / totale), LARGEUR_PROGRESSION)}  ${temps(position)} / ${temps(totale)}`;
}

/** « 🎐 Ambiance · Chenlin », ou l emoji du lieu s il existe sur le serveur. */
function ligneAmbiance(piste, guilde) {
  const majeure = piste.majeure ?? piste.categorie ?? 'divers';
  const texte = piste.lieu ? `${nomMajeure(majeure)} · ${nomLieu(piste.lieu)}` : nomMajeure(majeure);
  const icone = (piste.lieu && emoji(guilde, piste.lieu)) || emoji(guilde, majeure);
  return icone ? `${icone} ${texte}` : `〔${texte}〕`;
}

function description(s, guilde) {
  const e = etat(s);
  if (!e) return '*Rien en cours.*';

  const rang = s.total > 1 ? ` · piste ${s.rang} sur ${s.total}` : '';

  return `${e.icone}  **${s.courante.titre}**\n${ligneAmbiance(s.courante, guilde)}${rang}`
    + `\n\n${ligneProgression(s)}`;
}

// --- Navigation ----------------------------------------------------------

/**
 * Les deux menus : ou l on est, et ce qu il y a a cet endroit. Choisir un lieu
 * ne joue rien — c est de la navigation. Seul le menu des pistes lance quelque
 * chose, avec le bouton « Tout jouer ».
 */
function menus(apercu, guilde) {
  const rangees = [];

  const lieuxOptions = [
    {
      label: `Tous les lieux — ${nomMajeure(apercu.majeure)}`.slice(0, 100),
      value: TOUS,
      description: `${apercu.total} piste${apercu.total > 1 ? 's' : ''}`.slice(0, 100),
      default: apercu.lieu === TOUS,
    },
    ...apercu.lieux.slice(0, MAX_OPTIONS - 1).map((l) => {
      const valeur = l.slug ?? PARTOUT;
      const glose = l.propose ? `${l.glose} · proposé` : l.glose;
      const option = {
        label: `${l.nom} (${l.nombre})`.slice(0, 100),
        value: valeur,
        default: apercu.lieu === valeur,
      };
      if (glose) option.description = glose.slice(0, 100);
      // Meme convention que pour les des : un emoji du serveur nomme comme le
      // dossier illustre le lieu. Absent, on n en parle pas.
      const illustration = l.slug && emoji(guilde, l.slug);
      if (illustration) option.emoji = illustration;
      return option;
    }),
  ];

  rangees.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('musique:lieu')
      .setPlaceholder('Où sommes-nous ?')
      .addOptions(lieuxOptions)));

  if (apercu.pistes.length) {
    rangees.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('musique:piste')
        .setPlaceholder(apercu.pages > 1
          ? `Une piste précise — page ${apercu.page + 1} sur ${apercu.pages}`
          : 'Une piste précise')
        .addOptions(apercu.pistes.map((p) => ({
          label: p.titre.slice(0, 100),
          description: nomLieu(p.lieu).slice(0, 100),
          value: p.id.slice(0, 100),
        })))));
  }

  return rangees;
}

function commandes(s, apercu) {
  const enPause = s?.statut === AudioPlayerStatus.Paused;
  const joue = Boolean(s?.courante);

  const bouton = (id, emojiBouton, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`musique:${id}`).setEmoji(emojiBouton)
      .setStyle(style).setDisabled(!s);

  // La rangee de navigation ne depend d aucune session : on doit pouvoir
  // feuilleter la bibliotheque sans etre en vocal.
  const navigation = new ActionRowBuilder().addComponents(
    // Un bouton qui tourne, comme celui de la boucle : une majeure de plus sur
    // le disque reste atteignable sans ajouter de bouton — et il n y a plus une
    // seule rangee de libre.
    new ButtonBuilder()
      .setCustomId('musique:majeure')
      .setLabel(nomMajeure(apercu.majeure).slice(0, 80))
      .setEmoji(iconeMajeure(apercu.majeure))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(apercu.majeures.length < 2),
    new ButtonBuilder().setCustomId('musique:page-').setEmoji('◀')
      .setStyle(ButtonStyle.Secondary).setDisabled(apercu.page <= 0),
    new ButtonBuilder().setCustomId('musique:page+').setEmoji('▶')
      .setStyle(ButtonStyle.Secondary).setDisabled(apercu.page >= apercu.pages - 1),
    new ButtonBuilder()
      .setCustomId('musique:jouer')
      .setLabel('Tout jouer')
      .setEmoji('🎶')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!apercu.total),
  );

  // Cinq boutons au plus par rangee : celle-ci est pleine, d ou le melange en
  // bas avec l arret.
  const transport = new ActionRowBuilder().addComponents(
    bouton('lecture', enPause ? '▶️' : '⏸️', joue ? ButtonStyle.Primary : ButtonStyle.Secondary),
    bouton('suivant', '⏭️'),
    bouton('volume-', '🔉'),
    bouton('volume+', '🔊'),
    bouton('boucle', '🔁'),
  );

  const bas = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('musique:melanger')
      .setLabel('Mélanger')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!s?.file.length),
    new ButtonBuilder()
      .setCustomId('musique:stop')
      .setLabel('Arrêter et quitter')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!s),
  );

  return [navigation, transport, bas];
}

/** « Ambiance · Chenlin · pistes 26–50 sur 63 » : ou l on en est, sans s excuser. */
function situation(apercu) {
  const lieu = apercu.lieu === TOUS ? 'tous les lieux'
    : apercu.lieu === PARTOUT ? nomLieu(null)
      : nomLieu(apercu.lieu);
  const ou = `${nomMajeure(apercu.majeure)} · ${lieu}`;
  if (apercu.pages <= 1) {
    return `${ou} · ${apercu.total} piste${apercu.total > 1 ? 's' : ''}`;
  }
  const premier = apercu.page * PAR_PAGE + 1;
  const dernier = premier + apercu.pistes.length - 1;
  return `${ou} · pistes ${premier}–${dernier} sur ${apercu.total} · page ${apercu.page + 1}/${apercu.pages}`;
}

/**
 * Construit le panneau a partir de l etat courant. `s` peut etre null : le
 * panneau existe alors sans session, prêt a en ouvrir une.
 *
 * Rend de quoi appeler `send()` ou `edit()` tel quel. La piece jointe n est
 * renvoyee que si la pochette a change depuis la derniere fois.
 */
export function rendu(s, guilde) {
  const pistes = bibliotheque();
  const guildeId = s?.guildeId ?? guilde?.id ?? null;
  const e = etat(s);

  const embed = new EmbedBuilder()
    .setColor(e?.couleur ?? COULEURS.encre)
    .setTitle('太白金星 — Ambiances');

  if (!pistes.length) {
    embed.setColor(COULEURS.cinabre).setDescription(
      `Aucun fichier dans \`${config.dossierMusique}\`.\n\n` +
      'Dépose des `.mp3` ou des `.ogg` dans `ambiance/` ou `combat/`, ' +
      'dans le sous-dossier du lieu concerné — ou à la racine de l’un des deux ' +
      'si la piste vaut partout. Le nom du fichier devient le titre.'
    );
    return { embeds: [embed], components: [] };
  }

  const apercu = selection(guildeId);

  embed.setDescription(description(s, guilde));

  embed.addFields(
    {
      name: 'Volume',
      value: `${jauge((s?.volume ?? config.volumeDefaut) / VOLUME_MAX, LARGEUR_VOLUME)} ${pourcent(s?.volume ?? config.volumeDefaut)}`,
      inline: true,
    },
    {
      name: 'Boucle',
      value: `${ICONE_BOUCLE[s?.boucle ?? 'aucune']} ${DIT_BOUCLE[s?.boucle ?? 'aucune']}`,
      inline: true,
    },
    { name: 'En file', value: String(s?.file.length ?? 0), inline: true },
  );

  if (s?.file.length) {
    embed.addFields({
      name: 'À suivre',
      value: s.file.slice(0, MAX_A_SUIVRE).map((p, i) => `${i + 1}. ${p.titre}`).join('\n')
        + (s.file.length > MAX_A_SUIVRE ? `\n… et ${s.file.length - MAX_A_SUIVRE} autres` : ''),
    });
  }

  embed.setFooter({ text: situation(apercu).slice(0, 2048) });

  const message = {
    embeds: [embed],
    components: [...menus(apercu, guilde), ...commandes(s, apercu)],
  };

  // --- La pochette -------------------------------------------------------
  // Une edition qui ne parle ni de `files` ni de `attachments` conserve la
  // piece jointe deja en place : c est ce qui permet de rafraichir la barre
  // sans renvoyer l image. On ne la televerse donc qu au changement.
  const voulue = pochetteDe(s?.courante);
  const deja = guildeId ? posees.get(guildeId) ?? null : null;

  if (voulue) {
    const nom = `pochette${path.extname(voulue).toLowerCase()}`;
    embed.setThumbnail(`attachment://${nom}`);
    if (voulue !== deja) {
      message.files = [new AttachmentBuilder(voulue, { name: nom })];
      message.attachments = []; // remplace celle d avant plutot que de s y ajouter
      if (guildeId) posees.set(guildeId, voulue);
    }
  } else if (deja) {
    message.attachments = []; // la piste courante n a pas d image : on retire l ancienne
    if (guildeId) posees.delete(guildeId);
  }

  return message;
}

/**
 * Ce qu on laisse a l ecran en s arretant. Sans boutons : ils ne repondraient
 * plus a personne, et un panneau fige sur « En lecture » ferait chercher une
 * panne la ou il n y a qu un redeploiement.
 */
export function renduRedemarrage() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(COULEURS.encre)
      .setTitle('太白金星 — Ambiances')
      .setDescription('🌙 Je redémarre. Relance `/musique` dans un instant.')],
    components: [],
    attachments: [],
  };
}

export default { rendu, renduRedemarrage, oublierPochette };
