import {
  SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags,
} from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import {
  rejoindre, session, bibliotheque, rechercher, categories, MODES_BOUCLE,
} from '../lib/musique.js';
import { COULEURS } from '../lib/couleurs.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('musique')
  .setDescription('Ambiances sonores de la table')
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s
    .setName('jouer')
    .setDescription('Jouer une piste de la bibliotheque locale')
    .addStringOption((o) => o
      .setName('piste')
      .setDescription('Commence a taper : la liste se filtre')
      .setRequired(true)
      .setAutocomplete(true))
    .addBooleanOption((o) => o
      .setName('maintenant')
      .setDescription('Couper la piste en cours au lieu de faire la queue')))
  .addSubcommand((s) => s
    .setName('ambiance')
    .setDescription('Enchainer tout un dossier, en boucle')
    .addStringOption((o) => o
      .setName('categorie')
      .setDescription('Un sous-dossier de la bibliotheque')
      .setRequired(true)
      .setAutocomplete(true))
    .addBooleanOption((o) => o
      .setName('melanger')
      .setDescription('Ordre aleatoire (par defaut : oui)')))
  .addSubcommand((s) => s.setName('file').setDescription('Ce qui joue et ce qui suit'))
  .addSubcommand((s) => s.setName('pause').setDescription('Suspendre'))
  .addSubcommand((s) => s.setName('reprendre').setDescription('Reprendre'))
  .addSubcommand((s) => s.setName('suivant').setDescription('Passer a la piste suivante'))
  .addSubcommand((s) => s.setName('stop').setDescription('Tout arreter et quitter le salon'))
  .addSubcommand((s) => s.setName('melanger').setDescription('Rebattre la file'))
  .addSubcommand((s) => s
    .setName('volume')
    .setDescription('Regler le volume')
    .addIntegerOption((o) => o
      .setName('pourcentage')
      .setDescription('De 0 a 200 (100 = volume du fichier)')
      .setRequired(true)
      .setMinValue(0).setMaxValue(200)))
  .addSubcommand((s) => s
    .setName('boucle')
    .setDescription('Mode de repetition')
    .addStringOption((o) => o
      .setName('mode')
      .setDescription('aucune, piste, ou liste')
      .setRequired(true)
      .addChoices(
        { name: 'aucune — jouer puis se taire', value: 'aucune' },
        { name: 'piste — repeter la piste en cours', value: 'piste' },
        { name: 'liste — repeter toute la file', value: 'liste' },
      )))
  .addSubcommand((s) => s
    .setName('bibliotheque')
    .setDescription('Lister les fichiers disponibles')
    .addStringOption((o) => o
      .setName('categorie')
      .setDescription('Se limiter a un dossier')
      .setAutocomplete(true)));

export async function autocomplete(interaction) {
  const focus = interaction.options.getFocused(true);
  const saisie = focus.value ?? '';

  if (focus.name === 'categorie') {
    const cats = categories().filter((c) => c.toLowerCase().includes(saisie.toLowerCase()));
    return interaction.respond(cats.slice(0, 25).map((c) => ({ name: c, value: c })));
  }

  const pistes = rechercher(saisie, { limite: 25 });
  return interaction.respond(pistes.map((p) => ({
    name: `${p.categorie} · ${p.titre}`.slice(0, 100),
    value: p.id.slice(0, 100),
  })));
}

/** Toutes les sous-commandes hors « jouer » exigent une session en cours. */
function sessionRequise(interaction) {
  const s = session(interaction.guildId);
  if (!s) throw new Error('Je ne joue rien pour le moment.');
  return s;
}

const enPourcentage = (v) => `${Math.round(v * 100)} %`;

export async function execute(interaction) {
  const sous = interaction.options.getSubcommand();

  // --- Lecture seule : pas besoin du salon vocal ---
  if (sous === 'bibliotheque') {
    const categorie = interaction.options.getString('categorie');
    const pistes = bibliotheque({ forcer: true })
      .filter((p) => !categorie || p.categorie === categorie);

    if (!pistes.length) {
      return interaction.reply({
        content: `Aucun fichier dans \`${config.dossierMusique}\`${categorie ? ` (categorie ${categorie})` : ''}.\n` +
                 'Depose des .mp3 ou .ogg dans des sous-dossiers, un par ambiance.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const parCategorie = new Map();
    for (const p of pistes) {
      if (!parCategorie.has(p.categorie)) parCategorie.set(p.categorie, []);
      parCategorie.get(p.categorie).push(p.titre);
    }

    const embed = new EmbedBuilder()
      .setColor(COULEURS.encre)
      .setTitle('Bibliotheque sonore')
      .setFooter({ text: `${pistes.length} pistes · ${parCategorie.size} categories` });

    for (const [cat, titres] of [...parCategorie].slice(0, 25)) {
      const liste = titres.slice(0, 15).map((t) => `· ${t}`).join('\n');
      const reste = titres.length > 15 ? `\n… et ${titres.length - 15} autres` : '';
      embed.addFields({ name: `${cat} (${titres.length})`, value: (liste + reste).slice(0, 1024) });
    }
    return interaction.reply({ embeds: [embed] });
  }

  if (sous === 'file') {
    const s = sessionRequise(interaction);
    const embed = new EmbedBuilder()
      .setColor(COULEURS.encre)
      .setTitle(s.statut === AudioPlayerStatus.Paused ? 'En pause' : 'En cours')
      .setDescription(s.courante
        ? `**${s.courante.titre}**\n*${s.courante.categorie}*`
        : 'Rien pour le moment.')
      .addFields(
        { name: 'Volume', value: enPourcentage(s.volume), inline: true },
        { name: 'Boucle', value: s.boucle, inline: true },
        { name: 'En file', value: String(s.file.length), inline: true },
      );

    if (s.file.length) {
      embed.addFields({
        name: 'A suivre',
        value: s.file.slice(0, 10).map((p, i) => `${i + 1}. ${p.titre}`).join('\n')
          + (s.file.length > 10 ? `\n… et ${s.file.length - 10} autres` : ''),
      });
    }
    return interaction.reply({ embeds: [embed] });
  }

  // --- Actions sur une session existante ---
  if (sous === 'pause') {
    const s = sessionRequise(interaction);
    return interaction.reply(s.pause() ? '⏸ Suspendu.' : 'Rien a suspendre.');
  }
  if (sous === 'reprendre') {
    const s = sessionRequise(interaction);
    return interaction.reply(s.reprendre() ? '▶ On reprend.' : 'Rien en pause.');
  }
  if (sous === 'suivant') {
    const s = sessionRequise(interaction);
    const titre = s.courante?.titre;
    s.suivant();
    return interaction.reply(`⏭ ${titre ? `« ${titre} » ecartee.` : 'Piste suivante.'}`);
  }
  if (sous === 'stop') {
    const s = sessionRequise(interaction);
    s.stop();
    s.detruire();
    return interaction.reply('⏹ Silence. Je quitte le salon.');
  }
  if (sous === 'melanger') {
    const s = sessionRequise(interaction);
    return interaction.reply(`🔀 File rebattue (${s.melanger()} pistes).`);
  }
  if (sous === 'volume') {
    const s = sessionRequise(interaction);
    const v = s.definirVolume(interaction.options.getInteger('pourcentage', true) / 100);
    return interaction.reply(`🔊 Volume : ${enPourcentage(v)}`);
  }
  if (sous === 'boucle') {
    const s = sessionRequise(interaction);
    const mode = interaction.options.getString('mode', true);
    if (!MODES_BOUCLE.includes(mode)) throw new Error(`Mode inconnu : ${mode}`);
    s.boucle = mode;
    const dit = { aucune: 'Plus de repetition.', piste: 'La piste tournera en rond.', liste: 'La file tournera en rond.' };
    return interaction.reply(`🔁 ${dit[mode]}`);
  }

  // --- Mise en lecture : connexion vocale requise ---
  await interaction.deferReply();

  const membre = interaction.member;
  const s = await rejoindre(membre, interaction.channel);

  if (sous === 'jouer') {
    const requete = interaction.options.getString('piste', true);
    const trouvees = rechercher(requete, { limite: 1 });
    if (!trouvees.length) throw new Error(`Rien qui ressemble a « ${requete} » dans la bibliotheque.`);

    const piste = trouvees[0];
    const maintenant = interaction.options.getBoolean('maintenant') ?? false;

    if (maintenant) {
      s.file.unshift(piste);
      if (s.courante) s.suivant();
      else await s.demarrer();
    } else {
      s.ajouter([piste]);
      await s.demarrer();
    }

    const enAttente = s.courante?.id !== piste.id && !maintenant;
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COULEURS.jade)
        .setTitle(enAttente ? '➕ En file' : '🎵 Lecture')
        .setDescription(`**${piste.titre}**\n*${piste.categorie}*`)
        .setFooter({ text: enAttente ? `Position ${s.file.length} dans la file` : `Volume ${enPourcentage(s.volume)}` })],
    });
  }

  if (sous === 'ambiance') {
    const categorie = interaction.options.getString('categorie', true);
    const pistes = bibliotheque({ forcer: true }).filter((p) => p.categorie === categorie);
    if (!pistes.length) throw new Error(`Le dossier « ${categorie} » est vide ou inconnu.`);

    s.vider();
    s.ajouter(pistes);
    if ((interaction.options.getBoolean('melanger') ?? true)) s.melanger();
    s.boucle = 'liste';
    if (s.courante) s.suivant();
    else await s.demarrer();

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(COULEURS.jade)
        .setTitle(`🎐 Ambiance : ${categorie}`)
        .setDescription(`${pistes.length} pistes, en boucle.`)
        .setFooter({ text: `Volume ${enPourcentage(s.volume)} · /musique stop pour finir` })],
    });
  }

  throw new Error(`Sous-commande inconnue : ${sous}`);
}

export default { data, execute, autocomplete };
