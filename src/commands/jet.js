import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { evaluer, jetDAction } from '../lib/des.js';
import { personnages, journalJets } from '../lib/db.js';
import { COULEURS, WU_XING, ORDRE_WU_XING } from '../lib/couleurs.js';

export const data = new SlashCommandBuilder()
  .setName('jet')
  .setDescription('Lancer les des')
  .addSubcommand((s) => s
    .setName('des')
    .setDescription('Notation libre : 2d6+3, 4d6kh3, d100')
    .addStringOption((o) => o
      .setName('expression')
      .setDescription('Par exemple 2d6+3, d20, 4d6kh3 (garder les 3 plus hauts)')
      .setRequired(true)
      .setMaxLength(100))
    .addStringOption((o) => o
      .setName('motif')
      .setDescription('Ce que tu tentes')
      .setMaxLength(120))
    .addBooleanOption((o) => o
      .setName('discret')
      .setDescription('Resultat visible de toi seul (jet du MJ)')))
  .addSubcommand((s) => s
    .setName('action')
    .setDescription('Jet de la table : d20 + un des cinq mouvements')
    .addStringOption((o) => o
      .setName('mouvement')
      .setDescription('Le mouvement sollicite')
      .setRequired(true)
      .addChoices(...ORDRE_WU_XING.map((k) => ({
        name: `${WU_XING[k].hanzi} ${k} — ${WU_XING[k].sens}`,
        value: k,
      }))))
    .addIntegerOption((o) => o
      .setName('difficulte')
      .setDescription('Seuil a atteindre (10 aise, 15 delicat, 20 ardu, 25 heroique)')
      .setMinValue(1).setMaxValue(40))
    .addIntegerOption((o) => o
      .setName('bonus')
      .setDescription('Modificateur de circonstance')
      .setMinValue(-20).setMaxValue(20))
    .addStringOption((o) => o
      .setName('fortune')
      .setDescription('Avantage ou desavantage')
      .addChoices(
        { name: 'avantage (garder le meilleur)', value: 'avantage' },
        { name: 'desavantage (garder le pire)', value: 'desavantage' },
      ))
    .addBooleanOption((o) => o
      .setName('discret')
      .setDescription('Resultat visible de toi seul')));

export async function execute(interaction) {
  const discret = interaction.options.getBoolean('discret') ?? false;
  const flags = discret ? MessageFlags.Ephemeral : undefined;

  if (interaction.options.getSubcommand() === 'des') {
    const expression = interaction.options.getString('expression', true);
    const motif = interaction.options.getString('motif');

    const r = evaluer(expression); // les erreurs remontent au gestionnaire global
    journalJets.ajouter(interaction.guildId ?? '0', interaction.user.id, r.expression, r.total, r.detail);

    const embed = new EmbedBuilder()
      .setColor(COULEURS.or)
      .setAuthor({ name: interaction.member?.displayName ?? interaction.user.username,
                   iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`🎲 ${r.total}`)
      .setDescription(`\`${r.expression}\` → ${r.detail}`);
    if (motif) embed.addFields({ name: 'Motif', value: motif });

    return interaction.reply({ embeds: [embed], flags });
  }

  // --- Jet d action ---
  const mouvement = interaction.options.getString('mouvement', true);
  const difficulte = interaction.options.getInteger('difficulte');
  const bonus = interaction.options.getInteger('bonus') ?? 0;
  const fortune = interaction.options.getString('fortune') ?? 'aucun';

  const perso = interaction.guildId ? personnages.lire(interaction.guildId, interaction.user.id) : null;
  const attribut = perso ? perso[mouvement] : 0;

  const r = jetDAction({ attribut, bonus, avantage: fortune });
  const el = WU_XING[mouvement];

  const morceaux = [`d20 [${r.des.map((d) => (d === r.brut ? `**${d}**` : `~~${d}~~`)).join(', ')}]`];
  if (attribut) morceaux.push(`${attribut >= 0 ? '+' : '−'}${Math.abs(attribut)} (${mouvement})`);
  if (bonus) morceaux.push(`${bonus >= 0 ? '+' : '−'}${Math.abs(bonus)}`);

  let verdict = null;
  if (r.critique) verdict = '✦ **Reussite eclatante** — le Ciel y met la main.';
  else if (r.echecCritique) verdict = '☠ **Echec funeste** — quelque chose se retourne contre toi.';
  else if (difficulte != null) {
    const ecart = r.total - difficulte;
    if (ecart >= 5) verdict = `✔ **Reussite franche** (${ecart >= 0 ? '+' : ''}${ecart})`;
    else if (ecart >= 0) verdict = `✔ **Reussite de justesse** (+${ecart})`;
    else if (ecart >= -4) verdict = `✖ **Echec de peu** (${ecart}) — au MJ d en faire un cout`;
    else verdict = `✖ **Echec** (${ecart})`;
  }

  const embed = new EmbedBuilder()
    .setColor(r.echecCritique ? COULEURS.cinabre : r.critique ? COULEURS.jade : el.couleur)
    .setAuthor({ name: perso?.nom ?? interaction.member?.displayName ?? interaction.user.username,
                 iconURL: perso?.avatar ?? interaction.user.displayAvatarURL() })
    .setTitle(`${el.emoji} ${el.hanzi} ${mouvement} — ${r.total}`)
    .setDescription(morceaux.join(' '));

  if (difficulte != null) embed.addFields({ name: 'Difficulte', value: String(difficulte), inline: true });
  if (verdict) embed.addFields({ name: 'Verdict', value: verdict });
  if (!perso) embed.setFooter({ text: 'Aucune fiche : attribut compte pour 0. Vois /perso creer' });

  journalJets.ajouter(interaction.guildId ?? '0', interaction.user.id,
    `d20+${mouvement}`, r.total, morceaux.join(' '));

  return interaction.reply({ embeds: [embed], flags });
}

export default { data, execute };
