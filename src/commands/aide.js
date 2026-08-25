import { SlashCommandBuilder, EmbedBuilder, MessageFlags, version as versionDjs } from 'discord.js';
import { COULEURS, SIGNATURE } from '../lib/couleurs.js';
import { bibliotheque } from '../lib/musique.js';

const RUBRIQUES = {
  des: {
    titre: '🎲 Les des',
    lignes: [
      '`/jet des 2d6+3` — notation libre. `4d6kh3` garde les trois plus hauts, `3d10kl1` le plus bas.',
      '`/jet action mouvement:eau difficulte:15` — le jet de la table : d20 + le mouvement de ta fiche.',
      'Ajoute `fortune:avantage` pour deux des, `discret:vrai` pour un jet que toi seul verras.',
    ],
  },
  personnage: {
    titre: '📜 Les personnages',
    lignes: [
      '`/perso creer nom:… voie:…` — ta fiche. Le mouvement de ta voie monte a 3 au minimum.',
      '`/perso voir` · `/perso modifier` · `/perso liste`',
      '`/perso souffle variation:-2` — depenser du souffle ; positif pour en regagner.',
    ],
  },
  table: {
    titre: '🀄 A la table',
    lignes: [
      '`/scene texte:… ambiance:tendu` — un cartouche de narration, epinglable.',
      '`/pnj nature:immortel` — une figure complete, tiree au sort : nom, role, trait, secret.',
      '`/voix dire qui:… message:…` — le PNJ parle sous son nom et son portrait.',
      '`/voix enregistrer` garde un PNJ pour les prochaines seances.',
    ],
  },
  oracle: {
    titre: '☯ L oracle',
    lignes: [
      '`/oracle consulter question:…` — tirage aux trois pieces, traits mutants compris.',
      '`/oracle hexagramme numero:23` — lire une figure precise.',
    ],
  },
  musique: {
    titre: '🎐 La musique',
    lignes: [
      '`/musique jouer piste:…` — la liste se filtre a la frappe.',
      '`/musique ambiance categorie:temple` — tout un dossier, melange, en boucle.',
      '`/musique volume pourcentage:40` · `/musique pause` · `/musique suivant` · `/musique stop`',
      '`/musique bibliotheque` — ce que contient le dossier de musiques.',
    ],
  },
};

export const data = new SlashCommandBuilder()
  .setName('aide')
  .setDescription('Ce que je sais faire')
  .addStringOption((o) => o
    .setName('rubrique')
    .setDescription('Se limiter a un sujet')
    .addChoices(...Object.entries(RUBRIQUES).map(([k, v]) => ({ name: v.titre, value: k }))));

export async function execute(interaction) {
  const rubrique = interaction.options.getString('rubrique');
  const choisies = rubrique ? { [rubrique]: RUBRIQUES[rubrique] } : RUBRIQUES;

  const embed = new EmbedBuilder()
    .setColor(COULEURS.or)
    .setTitle(SIGNATURE)
    .setDescription(
      "L'etoile du soir, messagere de l'Empereur de Jade — et greffier de votre table.\n" +
      'Toutes les commandes commencent par `/`.'
    )
    .setFooter({
      text: `${bibliotheque().length} pistes en bibliotheque · discord.js ${versionDjs}`,
    });

  for (const r of Object.values(choisies)) {
    embed.addFields({ name: r.titre, value: r.lignes.join('\n') });
  }

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export default { data, execute };
