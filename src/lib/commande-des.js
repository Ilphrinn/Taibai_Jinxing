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

// --- Symboles ------------------------------------------------------------

// Les des pour lesquels une image existe dans assets/emoji/. Le d8 manque :
// game-icons.net ne le sert pas en fond transparent (403 constant, verifie le
// 26 aout 2026). Ajoute 8 ici le jour ou tu deposes d8.png.
const TYPES = new Set([2, 4, 6, 10, 12, 20]);

// Cherches par NOM, jamais par identifiant : rien a coder en dur, rien a
// reconfigurer si le serveur change. Voir assets/emoji/LISEZ-MOI.txt.
// Comparaison insensible a la casse : Discord conserve la casse du nom de
// fichier au televersement, et on ne va pas echouer en silence pour un « P ».
function emoji(guilde, nom) {
  const cherche = nom.toLowerCase();
  return guilde?.emojis.cache.find((e) => e.name.toLowerCase() === cherche)?.toString() ?? null;
}

// Un de sans image propre est ecrit comme une SOMME de des existants : le d26
// devient un d20 suivi d un d6, le d8 un d6 suivi d un d2. Glouton, du plus
// grand au plus petit, et il faut tomber juste — une approximation mentirait.
const DENOMINATIONS = [20, 12, 10, 6, 4, 2];

// Au-dela, la somme cesse de se lire d un coup d oeil et ne vaut plus mieux
// qu un de generique. Six couvre jusqu au d120.
const MAX_PIECES = 6;

function decomposer(faces) {
  const pieces = [];
  let reste = faces;
  for (const d of DENOMINATIONS) {
    while (reste >= d && pieces.length < MAX_PIECES) { pieces.push(d); reste -= d; }
    if (reste === 0) return pieces;
  }
  // Toutes les denominations sont paires : un de impair est donc impossible a
  // ecrire ainsi. d3, d5, d7, d27 tombent tous ici.
  return null;
}

/** L image d un type de de, ou null si on ne sait pas la composer. */
function image(guilde, faces) {
  // Le percentile n a pas d icone, ni sur game-icons.net ni dans son depot
  // amont : on montre les deux d10 qu on lance reellement.
  if (faces === 100) {
    const d10 = emoji(guilde, 'd10');
    return d10 && d10 + d10;
  }

  if (TYPES.has(faces)) return emoji(guilde, `d${faces}`);

  const pieces = decomposer(faces);
  if (!pieces) return null;
  const images = pieces.map((p) => emoji(guilde, `d${p}`));
  return images.every(Boolean) ? images.join('') : null;
}

// Ce qui reste sans image — les des impairs, les tres grands — prend le d6,
// choix d Ilphrinn : un vrai de plutot qu un pictogramme depareille. Un d27
// ressemble donc a un d6, ce qu il faut assumer. Le 🎲 ne sert plus que si le
// serveur n a meme pas televerse ses emojis.
const symbole = (guilde, faces) => image(guilde, faces) ?? emoji(guilde, 'd6') ?? '🎲';

// Un extreme se remarque : 1 ou face maximale, a partir du d6. Un de ecarte
// par kh/kl est barre.
function valeur(v, faces, garde) {
  if (!garde) return `~~${v}~~`;
  return faces >= 6 && (v === 1 || v === faces) ? `**${v}**` : String(v);
}

// --- Rendu ---------------------------------------------------------------

// Au-dela, un de par de deviendrait illisible, et surtout depasserait les 2000
// caracteres d un message : un emoji personnalise en pese une vingtaine, et le
// moteur accepte jusqu a 100 des. On retombe alors sur la forme compacte.
const MAX_DES_DETAILLES = 12;

// Le marqueur de cette forme compacte, choisi par Ilphrinn : il signale d un
// coup d oeil qu il y avait trop de des pour les montrer un par un. Si l emoji
// n existe pas sur le serveur, on retombe sur le 🎲.
const EMOJI_TROP_DE_DES = 'Power';

// Discord refuse les messages de plus de 2000 caracteres. Compter les des ne
// suffit pas : un de compose peut porter six emojis, et un emoji personnalise
// s ecrit « <:d20:1541805417653477499> ». Douze des ainsi composes frolent la
// limite — on mesure donc la ligne produite plutot que de deviner.
const LIMITE_MESSAGE = 1900;

const separateur = '\t';

function compacte(guilde, r) {
  return `${emoji(guilde, EMOJI_TROP_DE_DES) ?? '🎲'} **${r.total}**  ·  ${r.detail}`;
}

function rendre(interaction, r) {
  const guilde = interaction.guild;
  const groupes = r.termes.filter((t) => t.type === 'des');
  const nbDes = groupes.reduce((n, t) => n + t.nb, 0);

  if (nbDes > MAX_DES_DETAILLES) return compacte(guilde, r);

  // Un seul de, sans modificateur : le total dit tout, le detailler serait un
  // doublon — c est ce qu Ilphrinn avait releve.
  if (r.termes.length === 1 && groupes.length === 1 && groupes[0].nb === 1) {
    return `${symbole(guilde, groupes[0].faces)} **${r.total}**`;
  }

  const morceaux = [];
  for (const t of r.termes) {
    if (t.type === 'constante') {
      morceaux.push(`${t.signe < 0 ? '−' : '+'}${t.valeur}`);
      continue;
    }
    const s = symbole(guilde, t.faces);
    // Un de par de : c est ce qui montre qu il y a eu plusieurs jets.
    for (const d of t.des) {
      morceaux.push(`${t.signe < 0 ? '−' : ''}${s} ${valeur(d.v, t.faces, d.garde)}`);
    }
  }

  const ligne = `${morceaux.join(separateur)}${separateur}→ **${r.total}**`;
  return ligne.length > LIMITE_MESSAGE ? compacte(guilde, r) : ligne;
}

export async function executer(interaction) {
  const saisie = interaction.options.getString(NOM_ARGUMENT, true);

  // Les erreurs d analyse remontent au gestionnaire global d index.js, qui les
  // renvoie en ephemere : inutile de les attraper ici.
  const r = evaluer(normaliser(saisie));

  return interaction.reply(rendre(interaction, r));
}
