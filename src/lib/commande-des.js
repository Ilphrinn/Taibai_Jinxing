// Coeur commun a /d et /r : meme analyse, meme rendu. Deux noms parce que les
// joueurs ont l habitude de taper /r, et qu il n y a pas de raison de leur
// imposer le notre. Un seul endroit a modifier pour les deux.
import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { evaluer } from './des.js';

// Discord impose un nom a chaque option et l affiche dans la barre de saisie :
// il n existe pas d argument anonyme. Teste le 26 aout 2026, tout est refuse.
// L espace nu et l insecable ne passent meme pas la validation de discord.js
// (« Invalid string format »). U+3164, le remplisseur hangul, la passe — c est
// une lettre pour Unicode, dessinee vide — mais l API le rejette en
// STRING_TYPE_REGEX + BASE_TYPE_BAD_LENGTH : elle le voit comme une chaine
// vide. N y reviens pas : c est une limite ferme, pas un contournement a
// trouver. Change la valeur si tu veux un autre libelle, rien d autre ne bouge.
export const NOM_ARGUMENT = 'jet';

// « /d 6 » doit valoir 1d6. Le moteur, lui, lit « 6 » comme une constante, ce
// qui est juste pour « 2d6+3 » : la souplesse appartient donc a la commande.
// On ne convertit que si l expression entiere n est qu un nombre.
const NOMBRE_SEUL = /^\s*\d+\s*$/;
const normaliser = (saisie) => (NOMBRE_SEUL.test(saisie) ? `1d${saisie.trim()}` : saisie);

export function construire(nom, description) {
  return new SlashCommandBuilder()
    .setName(nom)
    .setDescription(description)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .addStringOption((o) => o
      .setName(NOM_ARGUMENT)
      .setDescription('6 pour 1d6 — ou une notation complète : 3d100, 2d6+3, 4d6kh3')
      .setRequired(true)
      .setMaxLength(100));
}

// Un seul de non modifie : le detail repeterait le total. Tout le reste
// (plusieurs des, un modificateur, des dessin ecartes) merite d etre montre.
const estSimple = (r) => r.jets.length === 1 && r.jets[0].nb === 1 && r.jets[0].somme === r.total;

// Les emojis du serveur sont cherches par NOM, jamais par identifiant : rien a
// coder en dur, et si l emoji n a pas ete televerse on retombe sur le 🎲 sans
// que personne ne s en apercoive. Voir assets/emoji/LISEZ-MOI.txt.
function emoji(guilde, nom) {
  return guilde?.emojis.cache.find((e) => e.name === nom)?.toString() ?? null;
}

// Parcimonieux a dessein : un seul de, et seulement la ou la face veut dire
// quelque chose. Un emoji partout deviendrait du bruit.
function des(interaction, r) {
  if (r.jets.length === 1 && r.jets[0].nb === 1) {
    const { faces, valeurs } = r.jets[0];
    const v = valeurs[0];
    if (faces === 6) return emoji(interaction.guild, `d6_${v}`);
    if (faces === 20 && (v === 1 || v === 20)) return emoji(interaction.guild, `d20_${v}`);
  }
  return null;
}

export async function executer(interaction) {
  const saisie = interaction.options.getString(NOM_ARGUMENT, true);

  // Les erreurs d analyse remontent au gestionnaire global d index.js, qui les
  // renvoie en ephemere : inutile de les attraper ici.
  const r = evaluer(normaliser(saisie));

  const symbole = des(interaction, r) ?? '🎲';

  // Le detail contient deja la notation : la repeter serait un doublon.
  return interaction.reply(estSimple(r)
    ? `${symbole} **${r.total}**`
    : `${symbole} **${r.total}**  ·  ${r.detail}`);
}
