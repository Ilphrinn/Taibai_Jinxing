// Lancer de des, en une commande courte. Toute la souplesse de notation vient
// de lib/des.js, qui met deja l expression en minuscules et supprime les espaces.
import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { evaluer } from '../lib/des.js';

// « /d 6 » doit valoir 1d6. Le moteur, lui, lit « 6 » comme une constante, ce
// qui est juste pour « 2d6+3 » : la souplesse appartient donc a la commande.
// On ne convertit que si l expression entiere n est qu un nombre.
const NOMBRE_SEUL = /^\s*\d+\s*$/;
const normaliser = (saisie) => (NOMBRE_SEUL.test(saisie) ? `1d${saisie.trim()}` : saisie);

export const data = new SlashCommandBuilder()
  .setName('d')
  .setDescription('Lancer les dés : 6 → 1d6, ou 3d100, 1D20, 2d6+3, 4d6kh3')
  .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
  .addStringOption((o) => o
    .setName('des')
    .setDescription('6 pour 1d6 — ou une notation complète : 3d100, 2d6+3, 4d6kh3 (garder les 3 meilleurs)')
    .setRequired(true)
    .setMaxLength(100));

export async function execute(interaction) {
  const saisie = interaction.options.getString('des', true);

  // Les erreurs d analyse remontent au gestionnaire global d index.js, qui les
  // renvoie en ephemere : inutile de les attraper ici.
  const r = evaluer(normaliser(saisie));

  return interaction.reply(`🎲 **${r.total}**  ·  \`${r.expression}\` → ${r.detail}`);
}

export default { data, execute };
