// Liste unique des permissions demandees. Sert au lien d invitation, au README
// et au diagnostic de demarrage : une seule source, pas de nombre magique.
import { PermissionsBitField } from 'discord.js';

export const PERMISSIONS = [
  // --- Indispensables ---
  ['ViewChannel',           'Voir les salons',                'lire les salons ou le bot repond'],
  ['SendMessages',          'Envoyer des messages',           'toute reponse ecrite'],
  ['SendMessagesInThreads', 'Ecrire dans les fils',           'jouer une scene dans un fil'],
  ['EmbedLinks',            'Integrer des liens',             'fiches de personnage, oracle, scenes'],
  ['AttachFiles',           'Joindre des fichiers',           'exports, images de scene'],
  ['ReadMessageHistory',    'Lire l historique',              'repondre a un message cite'],
  ['UseExternalEmojis',     'Emojis externes',                'mise en forme des fiches'],
  ['AddReactions',          'Ajouter des reactions',          'votes rapides, accuses de reception'],

  // --- Voix : lecture des musiques locales ---
  ['Connect',               'Se connecter',                   'entrer dans le salon vocal'],
  ['Speak',                 'Parler',                         'diffuser la musique'],
  ['UseVAD',                'Detection de la voix',           'emettre sans push-to-talk'],
  ['PrioritySpeaker',       'Voix prioritaire',               'baisser la musique quand le MJ parle'],

  // --- Confort de maitre du jeu ---
  ['ManageWebhooks',        'Gerer les webhooks',             'faire parler les PNJ sous leur nom et leur portrait'],
  ['ManageMessages',        'Gerer les messages',             'epingler une scene, effacer une erreur'],
  ['CreatePublicThreads',   'Creer des fils publics',         'un fil par scene'],
  ['CreatePrivateThreads',  'Creer des fils prives',          'apartes entre le MJ et un joueur'],
  ['ManageThreads',         'Gerer les fils',                 'archiver une scene terminee'],
  ['MoveMembers',           'Deplacer les membres',           'reunir la table dans un meme salon vocal'],
  ['MuteMembers',           'Rendre muet',                    'silence rituel pendant une scene'],
  ['ManageNicknames',       'Gerer les pseudos',              'renommer un joueur du nom de son personnage'],
  ['ManageRoles',           'Gerer les roles',                'attribuer le role de sa maison ou de sa secte'],
];

/** Somme des bits, calculee par discord.js : aucun nombre saisi a la main. */
export function bitfield(noms = PERMISSIONS.map(([n]) => n)) {
  return new PermissionsBitField(noms).bitfield;
}

/** Le strict necessaire, si tu preferes un bot discret au depart. */
export const MINIMALES = [
  'ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory',
  'Connect', 'Speak', 'UseVAD',
];

export function lienInvitation(applicationId, noms) {
  const p = bitfield(noms).toString();
  return `https://discord.com/api/oauth2/authorize?client_id=${applicationId}&permissions=${p}&scope=bot%20applications.commands`;
}
