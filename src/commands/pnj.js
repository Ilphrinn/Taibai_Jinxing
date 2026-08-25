import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { figure } from '../data/noms.js';
import { dLance } from '../lib/des.js';
import { COULEURS } from '../lib/couleurs.js';

const CATEGORIES = {
  humain: { titre: 'Une figure du monde', couleur: COULEURS.encre },
  immortel: { titre: 'Un immortel', couleur: COULEURS.or },
  demon: { titre: 'Une creature', couleur: COULEURS.cinabre },
  fonctionnaire: { titre: 'Un fonctionnaire celeste', couleur: COULEURS.pourpre },
};

export const data = new SlashCommandBuilder()
  .setName('pnj')
  .setDescription('Inventer un personnage non joueur sur-le-champ')
  .addStringOption((o) => o
    .setName('nature')
    .setDescription('Ce qui se presente')
    .addChoices(
      { name: 'humain — marchands, magistrats, moines', value: 'humain' },
      { name: 'immortel — cultivateurs et esprits des cimes', value: 'immortel' },
      { name: 'creature — renardes, revenants, affames', value: 'demon' },
      { name: 'fonctionnaire — administration du Ciel et des Enfers', value: 'fonctionnaire' },
    ))
  .addIntegerOption((o) => o
    .setName('combien')
    .setDescription('Jusqu a 5 d un coup')
    .setMinValue(1).setMaxValue(5))
  .addBooleanOption((o) => o
    .setName('discret')
    .setDescription('Pour le MJ seul'));

export async function execute(interaction) {
  const nature = interaction.options.getString('nature') ?? 'humain';
  const combien = interaction.options.getInteger('combien') ?? 1;
  const discret = interaction.options.getBoolean('discret') ?? false;
  const style = CATEGORIES[nature];

  const embeds = Array.from({ length: combien }, () => {
    const f = figure(dLance, nature);
    return new EmbedBuilder()
      .setColor(style.couleur)
      .setTitle(`${f.nom.hanzi} — ${f.nom.pinyin}`)
      .setDescription(`*${f.nom.sens}*`)
      .addFields(
        { name: 'Ce qu il est', value: f.role },
        { name: 'Ce qui se remarque', value: f.trait },
        { name: 'Ce qui se cache', value: `||${f.secret}||` },
      )
      .setFooter({ text: style.titre });
  });

  return interaction.reply({
    embeds,
    flags: discret ? MessageFlags.Ephemeral : undefined,
  });
}

export default { data, execute };
