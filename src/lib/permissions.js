// Liste unique des permissions demandees. Sert au lien d invitation, au README
// et au diagnostic de demarrage : une seule source, pas de nombre magique.
//
// La regle : on ne demande que ce que le code exerce reellement. Deux commandes,
// huit permissions. Si tu ajoutes une fonction, ajoute sa permission ici et
// regenere le lien — le bitfield du README se recalcule a partir de cette liste.
import { PermissionsBitField } from 'discord.js';

export const PERMISSIONS = [
  // --- Repondre, quelle que soit la commande ---
  ['ViewChannel',           'Voir les salons',        'lire les salons ou le bot repond'],
  ['SendMessages',          'Envoyer des messages',   'toute reponse ecrite'],
  ['SendMessagesInThreads', 'Ecrire dans les fils',   'repondre a une commande lancee dans un fil'],
  ['EmbedLinks',            'Integrer des liens',     'le panneau de /musique est un encart'],
  ['ReadMessageHistory',    'Lire l historique',      'retrouver le panneau pour le mettre a jour'],

  // --- Voix : lecture des musiques locales ---
  ['Connect',               'Se connecter',           'entrer dans le salon vocal'],
  ['Speak',                 'Parler',                 'diffuser la musique'],
  ['UseVAD',                'Detection de la voix',   'emettre sans push-to-talk'],
];

/** Somme des bits, calculee par discord.js : aucun nombre saisi a la main. */
export function bitfield(noms = PERMISSIONS.map(([n]) => n)) {
  return new PermissionsBitField(noms).bitfield;
}

/** Sans la voix : /d seul, si tu veux d abord essayer le bot en salon texte. */
export const MINIMALES = ['ViewChannel', 'SendMessages', 'EmbedLinks'];

export function lienInvitation(applicationId, noms) {
  const p = bitfield(noms).toString();
  return `https://discord.com/api/oauth2/authorize?client_id=${applicationId}&permissions=${p}&scope=bot%20applications.commands`;
}
