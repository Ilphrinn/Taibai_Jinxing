import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType,
  PermissionFlagsBits, MessageFlags,
} from 'discord.js';
import { COULEURS } from '../lib/couleurs.js';

const AMBIANCES = {
  neutre: { couleur: COULEURS.encre, marque: '·' },
  paisible: { couleur: COULEURS.jade, marque: '🎐' },
  tendu: { couleur: COULEURS.cinabre, marque: '⚔' },
  surnaturel: { couleur: COULEURS.pourpre, marque: '✦' },
  faste: { couleur: COULEURS.or, marque: '☀' },
};

export const data = new SlashCommandBuilder()
  .setName('scene')
  .setDescription('Poser une scene : un cartouche de narration')
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) => o
    .setName('texte')
    .setDescription('La description. Utilise \\n pour aller a la ligne.')
    .setRequired(true)
    .setMaxLength(4000))
  .addStringOption((o) => o
    .setName('titre')
    .setDescription('Le lieu, le moment')
    .setMaxLength(200))
  .addStringOption((o) => o
    .setName('ambiance')
    .setDescription('Teinte du cartouche')
    .addChoices(...Object.keys(AMBIANCES).map((k) => ({ name: k, value: k }))))
  .addStringOption((o) => o
    .setName('image')
    .setDescription('URL d une illustration'))
  .addBooleanOption((o) => o
    .setName('epingler')
    .setDescription('Epingler la scene dans le salon'));

export async function execute(interaction) {
  const texte = interaction.options.getString('texte', true).replace(/\\n/g, '\n');
  const titre = interaction.options.getString('titre');
  const image = interaction.options.getString('image');
  const style = AMBIANCES[interaction.options.getString('ambiance') ?? 'neutre'];
  const epingler = interaction.options.getBoolean('epingler') ?? false;

  if (image && !/^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(image)) {
    throw new Error('L illustration doit etre une URL https vers une image.');
  }

  const embed = new EmbedBuilder()
    .setColor(style.couleur)
    .setDescription(texte)
    .setFooter({
      text: `${style.marque} pose par ${interaction.member?.displayName ?? interaction.user.username}`,
    });
  if (titre) embed.setTitle(`${style.marque} ${titre}`);
  if (image) embed.setImage(image);

  const message = await interaction.reply({ embeds: [embed], withResponse: true });
  if (!epingler) return message;

  const envoye = message.resource?.message ?? await interaction.fetchReply();
  const perms = interaction.channel.permissionsFor(interaction.guild.members.me);
  if (!perms?.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.followUp({
      content: 'Scene posee, mais il me manque « Gerer les messages » pour l epingler.',
      flags: MessageFlags.Ephemeral,
    });
  }
  await envoye.pin().catch(() => null);
  return envoye;
}

export default { data, execute };
