import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { personnages } from '../lib/db.js';
import { COULEURS, WU_XING, ORDRE_WU_XING, DOMINE } from '../lib/couleurs.js';

const PALIERS = [
  'Trempe du corps', 'Etablissement des fondations', 'Formation du noyau de jade',
  'Ame naissante', 'Transformation du souffle', 'Franchissement de l epreuve celeste',
];

const choixVoie = ORDRE_WU_XING.map((k) => ({
  name: `${WU_XING[k].hanzi} ${k} — ${WU_XING[k].sens}`,
  value: k,
}));

function attribut(builder, nom) {
  return builder.addIntegerOption((o) => o
    .setName(nom)
    .setDescription(`${WU_XING[nom].hanzi} ${WU_XING[nom].sens}`)
    .setMinValue(-2).setMaxValue(8));
}

export const data = new SlashCommandBuilder()
  .setName('perso')
  .setDescription('Fiche de personnage')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => {
    s.setName('creer')
      .setDescription('Creer ou remplacer ta fiche')
      .addStringOption((o) => o
        .setName('nom').setDescription('Nom du personnage').setRequired(true).setMaxLength(64))
      .addStringOption((o) => o
        .setName('voie').setDescription('Le mouvement dominant').setRequired(true)
        .addChoices(...choixVoie))
      .addStringOption((o) => o
        .setName('titre').setDescription('Titre, secte, fonction').setMaxLength(100));
    for (const nom of ORDRE_WU_XING) attribut(s, nom);
    return s
      .addStringOption((o) => o.setName('notes').setDescription('Ce qui ne rentre nulle part').setMaxLength(1000))
      .addStringOption((o) => o.setName('portrait').setDescription('URL d une image'));
  })
  .addSubcommand((s) => s
    .setName('voir')
    .setDescription('Afficher une fiche')
    .addUserOption((o) => o.setName('joueur').setDescription('Par defaut : toi')))
  .addSubcommand((s) => {
    s.setName('modifier').setDescription('Retoucher ta fiche, champ par champ')
      .addStringOption((o) => o.setName('nom').setDescription('Nouveau nom').setMaxLength(64))
      .addStringOption((o) => o.setName('titre').setDescription('Nouveau titre').setMaxLength(100))
      .addStringOption((o) => o.setName('voie').setDescription('Nouveau mouvement dominant').addChoices(...choixVoie))
      .addIntegerOption((o) => o.setName('palier').setDescription('Palier de cultivation, de 1 a 6').setMinValue(1).setMaxValue(6));
    for (const nom of ORDRE_WU_XING) attribut(s, nom);
    return s
      .addIntegerOption((o) => o.setName('souffle_max').setDescription('Reserve de souffle maximale').setMinValue(1).setMaxValue(999))
      .addIntegerOption((o) => o.setName('karma').setDescription('Compteur de karma').setMinValue(-99).setMaxValue(99))
      .addStringOption((o) => o.setName('notes').setDescription('Remplace les notes').setMaxLength(1000))
      .addStringOption((o) => o.setName('portrait').setDescription('URL d une image'));
  })
  .addSubcommand((s) => s
    .setName('souffle')
    .setDescription('Depenser ou regagner du souffle')
    .addIntegerOption((o) => o
      .setName('variation')
      .setDescription('Negatif pour depenser, positif pour regagner')
      .setRequired(true).setMinValue(-999).setMaxValue(999)))
  .addSubcommand((s) => s.setName('liste').setDescription('Toutes les fiches du serveur'))
  .addSubcommand((s) => s.setName('effacer').setDescription('Effacer ta fiche, sans retour'));

function fiche(perso, membre) {
  const el = WU_XING[perso.voie] ?? WU_XING.terre;
  const barre = (v, max) => {
    const n = Math.max(0, Math.min(10, Math.round((v / Math.max(1, max)) * 10)));
    return '█'.repeat(n) + '░'.repeat(10 - n);
  };

  const embed = new EmbedBuilder()
    .setColor(el.couleur)
    .setTitle(`${el.emoji} ${perso.nom}`)
    .setDescription([
      perso.titre ? `*${perso.titre}*` : null,
      `**Voie du ${perso.voie}** ${el.hanzi} — domine le ${DOMINE[perso.voie]}`,
      `**${PALIERS[perso.palier - 1] ?? PALIERS[0]}** (palier ${perso.palier})`,
    ].filter(Boolean).join('\n'))
    .addFields(
      {
        name: 'Cinq mouvements',
        value: ORDRE_WU_XING
          .map((k) => `${WU_XING[k].hanzi} ${k.padEnd(6)} ${perso[k] >= 0 ? '+' : '−'}${Math.abs(perso[k])}`)
          .join('\n'),
        inline: true,
      },
      {
        name: 'Etat',
        value: `Souffle ${perso.souffle}/${perso.souffle_max}\n\`${barre(perso.souffle, perso.souffle_max)}\`\n` +
               `Karma ${perso.karma >= 0 ? '+' : '−'}${Math.abs(perso.karma)}`,
        inline: true,
      },
    );

  if (perso.notes) embed.addFields({ name: 'Notes', value: perso.notes.slice(0, 1024) });
  if (perso.avatar) embed.setThumbnail(perso.avatar);
  if (membre) embed.setFooter({ text: `Joue par ${membre.displayName}` });
  return embed;
}

const urlValide = (u) => !u || /^https:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i.test(u);

export async function execute(interaction) {
  const guilde = interaction.guildId;
  const moi = interaction.user.id;
  const sous = interaction.options.getSubcommand();

  if (sous === 'creer') {
    const portrait = interaction.options.getString('portrait');
    if (!urlValide(portrait)) throw new Error('Le portrait doit etre une URL https se terminant par .png, .jpg, .gif ou .webp.');

    const champs = {
      nom: interaction.options.getString('nom', true),
      voie: interaction.options.getString('voie', true),
      titre: interaction.options.getString('titre'),
      notes: interaction.options.getString('notes'),
      avatar: portrait,
    };
    for (const k of ORDRE_WU_XING) champs[k] = interaction.options.getInteger(k) ?? 2;

    // Le mouvement dominant vaut au moins 3 : c est ce qui definit la voie.
    if (champs[champs.voie] < 3) champs[champs.voie] = 3;

    const perso = personnages.creer(guilde, moi, champs);
    return interaction.reply({
      content: 'Fiche enregistree. `/perso modifier` pour la retoucher.',
      embeds: [fiche(perso, interaction.member)],
    });
  }

  if (sous === 'voir') {
    const cible = interaction.options.getUser('joueur') ?? interaction.user;
    const perso = personnages.lire(guilde, cible.id);
    if (!perso) {
      throw new Error(cible.id === moi
        ? 'Tu n as pas encore de fiche. Commence par `/perso creer`.'
        : `${cible.username} n a pas de fiche sur ce serveur.`);
    }
    const membre = await interaction.guild.members.fetch(cible.id).catch(() => null);
    return interaction.reply({ embeds: [fiche(perso, membre)] });
  }

  if (sous === 'modifier') {
    if (!personnages.lire(guilde, moi)) throw new Error('Aucune fiche a modifier. Vois `/perso creer`.');

    const portrait = interaction.options.getString('portrait');
    if (!urlValide(portrait)) throw new Error('Le portrait doit etre une URL https vers une image.');

    const champs = {
      nom: interaction.options.getString('nom') ?? undefined,
      titre: interaction.options.getString('titre') ?? undefined,
      voie: interaction.options.getString('voie') ?? undefined,
      palier: interaction.options.getInteger('palier') ?? undefined,
      souffle_max: interaction.options.getInteger('souffle_max') ?? undefined,
      karma: interaction.options.getInteger('karma') ?? undefined,
      notes: interaction.options.getString('notes') ?? undefined,
      avatar: portrait ?? undefined,
    };
    for (const k of ORDRE_WU_XING) champs[k] = interaction.options.getInteger(k) ?? undefined;

    if (Object.values(champs).every((v) => v === undefined)) {
      throw new Error('Precise au moins un champ a modifier.');
    }

    let perso = personnages.modifier(guilde, moi, champs);
    // Le souffle courant ne depasse jamais la reserve.
    if (perso.souffle > perso.souffle_max) {
      perso = personnages.modifier(guilde, moi, { souffle: perso.souffle_max });
    }
    return interaction.reply({ content: 'Fiche mise a jour.', embeds: [fiche(perso, interaction.member)] });
  }

  if (sous === 'souffle') {
    const perso = personnages.lire(guilde, moi);
    if (!perso) throw new Error('Aucune fiche. Vois `/perso creer`.');

    const variation = interaction.options.getInteger('variation', true);
    const avant = perso.souffle;
    const apres = Math.max(0, Math.min(perso.souffle_max, avant + variation));
    personnages.modifier(guilde, moi, { souffle: apres });

    const signe = variation >= 0 ? '+' : '−';
    const etat = apres === 0 ? '\n**Souffle epuise.** Chaque effort coute desormais du sang.'
      : apres <= perso.souffle_max / 4 ? '\nLe souffle se fait court.' : '';

    return interaction.reply(
      `${WU_XING[perso.voie].emoji} **${perso.nom}** : ${signe}${Math.abs(variation)} souffle — ` +
      `${apres}/${perso.souffle_max}${etat}`
    );
  }

  if (sous === 'liste') {
    const tous = personnages.liste(guilde);
    if (!tous.length) throw new Error('Aucune fiche sur ce serveur pour l instant.');
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COULEURS.or)
        .setTitle(`Les personnages (${tous.length})`)
        .setDescription(tous.map((p) =>
          `${WU_XING[p.voie]?.emoji ?? '·'} **${p.nom}**${p.titre ? ` — *${p.titre}*` : ''} · <@${p.joueur_id}>`
        ).join('\n').slice(0, 4000))],
    });
  }

  if (sous === 'effacer') {
    if (!personnages.supprimer(guilde, moi)) throw new Error('Tu n avais pas de fiche.');
    return interaction.reply({ content: 'Fiche effacee.', flags: MessageFlags.Ephemeral });
  }
}

export default { data, execute };
