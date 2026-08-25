import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { tirer, dessiner, trigrammesDe, HEXAGRAMMES } from '../data/hexagrammes.js';
import { dLance } from '../lib/des.js';
import { COULEURS } from '../lib/couleurs.js';

const NOMS_TRAITS = ['premier', 'deuxieme', 'troisieme', 'quatrieme', 'cinquieme', 'sixieme'];

export const data = new SlashCommandBuilder()
  .setName('oracle')
  .setDescription('Consulter le Yi Jing')
  .addSubcommand((s) => s
    .setName('consulter')
    .setDescription('Tirage aux trois pieces, six fois')
    .addStringOption((o) => o
      .setName('question')
      .setDescription('La question posee au Livre')
      .setMaxLength(200))
    .addBooleanOption((o) => o
      .setName('discret')
      .setDescription('Reponse visible de toi seul')))
  .addSubcommand((s) => s
    .setName('hexagramme')
    .setDescription('Lire un hexagramme precis, par son numero')
    .addIntegerOption((o) => o
      .setName('numero')
      .setDescription('De 1 a 64')
      .setRequired(true)
      .setMinValue(1).setMaxValue(64)));

export async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'hexagramme') {
    const h = HEXAGRAMMES[interaction.options.getInteger('numero', true)];
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COULEURS.pourpre)
        .setTitle(`${h.n}. ${h.hanzi} ${h.pinyin} — ${h.nom}`)
        .setDescription(h.conseil)],
    });
  }

  const question = interaction.options.getString('question');
  const discret = interaction.options.getBoolean('discret') ?? false;

  const t = tirer(dLance);
  const { bas, haut } = trigrammesDe(t.traits);
  const indicesMutants = t.mutants.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);

  const embed = new EmbedBuilder()
    .setColor(COULEURS.pourpre)
    .setTitle(`${t.depart.n}. ${t.depart.hanzi} ${t.depart.pinyin} — ${t.depart.nom}`)
    .setDescription(
      `\`\`\`\n${dessiner(t.traits, t.mutants)}\n\`\`\`\n` +
      `*${haut.hanzi} ${haut.nom} sur ${bas.hanzi} ${bas.nom}*\n\n${t.depart.conseil}`
    );

  if (question) embed.setAuthor({ name: `« ${question} »` });

  if (indicesMutants.length) {
    embed.addFields({
      name: `Traits mutants (${indicesMutants.length})`,
      value: indicesMutants.map((i) => `le ${NOMS_TRAITS[i]} trait`).join(', ')
        + '\n*C est la que le changement travaille.*',
    });
    embed.addFields({
      name: `Devient — ${t.arrivee.n}. ${t.arrivee.hanzi} ${t.arrivee.pinyin} — ${t.arrivee.nom}`,
      value: t.arrivee.conseil,
    });
  } else {
    embed.addFields({
      name: 'Aucun trait mutant',
      value: 'La situation ne bouge pas. Lis la seule figure, et attends.',
    });
  }

  embed.setFooter({ text: `Tirage : ${t.valeurs.join(' · ')}` });

  return interaction.reply({
    embeds: [embed],
    flags: discret ? MessageFlags.Ephemeral : undefined,
  });
}

export default { data, execute };
