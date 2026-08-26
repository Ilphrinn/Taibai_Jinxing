# Note pour un futur moi

Bot Discord pour la table de JDR en Chine mythologique d'Ilphrinn. Écrit le
25 août 2026 d'un seul jet, puis **fortement élagué le 26 août** à sa demande.
Ce fichier dit **pourquoi** les choses sont ainsi ; le `README.md` dit comment s'en
servir. Lis les deux avant de toucher quoi que ce soit.

---

## État réel au moment où j'écris (26 août 2026)

**Il reste trois commandes : `/d`, son alias `/r`, et `/musique`.**

**Vérifié :** `npm run verif` passe (2 commandes, 8 permissions, chaîne audio
complète). Le moteur de dés est testé sur toute la notation, raccourci compris.
Depuis le 26 août au soir, `verif` dessine aussi le panneau de `/musique` sur
huit fausses sessions — dont trois de navigation —, vérifie les limites de Discord
et **imprime l'aperçu en texte** : les jauges, l'arbre des lieux, les libellés de
la rangée de navigation et ce qui y est grisé. C'est le seul moyen de voir tout
ça sans connexion. Exercé le 26 août sur une bibliothèque fabriquée de 36 pistes :
deux majeures, quatre lieux, pagination à deux pages, lieu inconnu rangé en fin de
liste — tout se tient.
Lancé avec un jeton bidon, `src/index.js` va jusqu'à `TokenInvalid` — ce qui prouve
tout le chemin de démarrage sauf la connexion elle-même.

**Deuxième passe du 26 août au soir**, après qu'il m'a demandé ce que je voyais
d'autre d'utile. Trois chantiers, tous vérifiés par `verif` : les défauts du
panneau (ouverture sans vocal, replacement quand il est enterré, mot laissé avant
un redéploiement, lecture réservée au maître), le son (fondu séquentiel et
égalisation du volume par `volumedetect`), et l'acheminement des fichiers audio.
`verif` a une section **Son** de plus : durée, niveau mesuré, gain retenu et rampe
de fondu. Exercé sur `cloche-longue.ogg` : 45 s, moyen −21,1 dB, crête −17,9 dB,
gain ×1,14.

Écarté ce soir-là, sur sa réponse : le jet caché du meneur.

**Jamais exécuté :** le bot **ne s'est toujours jamais connecté à Discord**. Il a été
déployé sur Railway le 26 août et y a tourné en boucle d'échec (voir les pièges
ci-dessous). Il n'y a ni `.env` local, ni fichier audio dans `assets/musique/` —
sinon une tonalité d'essai fabriquée localement, exclue du dépôt par `.gitignore`.

Donc **rien du chemin vocal ni du panneau à boutons n'a tourné en conditions
réelles** : `joinVoiceChannel`, la lecture, l'aiguillage des composants, le
rafraîchissement automatique du panneau. Si quelque chose casse au premier
lancement, c'est là qu'il faut chercher en premier, pas dans la logique.

### Ce qui a été retiré, et pourquoi

Le 26 août, Ilphrinn a demandé l'élagage. Supprimées : `/aide` (redondante avec les
descriptions Discord), `/oracle`, `/perso`, `/pnj`, `/voix`, `/scene`, et `/jet`
remplacée par `/d`. Motif donné : trop de commandes, et pour trois d'entre elles il
ne savait pas ce qu'elles faisaient — ce qui en dit long sur le fait qu'elles
répondaient à mes idées, pas à ses besoins.

**Ne les redéploie pas d'initiative.** Tout est dans l'historique git au commit
`53815c1` si le sujet revient.

Conséquence en cascade : les trois tables SQLite servaient `/perso`, `/voix` et le
journal des jets. **Il n'y a plus de base de données du tout** — donc plus de
`node:sqlite`, plus de `DATA_DIR`, et surtout **plus de volume Railway à monter**.
Le déploiement s'en trouve nettement simplifié.

---

## Le ton, et pourquoi il compte

Ilphrinn écrit un français soigné, sans jargon, en tutoyant : tableaux, phrases
courtes, honnêteté sur ce qui coince (`Besoin/DISCORD.md` en est le modèle — relis-le
pour te recaler). **Tout ce qui est visible par un humain est en français**, y compris
les messages d'erreur du bot. Garde ce registre : ni emphase commerciale, ni « super ! »,
ni promesses que le code ne tient pas.

Deux conventions d'écriture, à ne pas confondre :

- **Dans `src/`** : commentaires et identifiants en français **sans accents**
  (`bibliotheque`, `deja detruite`). C'est délibéré — ça évite toute question
  d'encodage sur une chaîne d'outils Windows/Docker. Les chaînes affichées aux
  joueurs et les descriptions de commandes gardent leurs accents.
- **Dans les `.md`** : français complet, accentué.

---

## Décisions structurantes

**Aucun intent privilégié.** Uniquement `Guilds` et `GuildVoiceStates`. Le bot ne
lit aucun message : tout passe par les commandes `/` et les boutons. Rien à activer
dans le portail développeur, et pas de vérification Discord à cent serveurs. Si tu
ajoutes une fonction qui réclame `MessageContent`, sache que tu casses cette
propriété — pèse-la.

**`src/lib/permissions.js` est la source unique du lien d'invitation.** Le bitfield
(`274914692096`) est calculé par discord.js à partir de cette liste, jamais saisi à
la main. Si tu changes la liste, régénère le lien **et** le nombre écrit dans le
README, sinon les deux divergent en silence.

La règle depuis l'élagage : **on ne demande que ce que le code exerce réellement.**
J'avais d'abord demandé 21 permissions dont 11 ne servaient à rien — de
l'anticipation déguisée en besoin. Il en reste 8. Ne rajoute une permission qu'avec
la ligne de code qui s'en sert.

**Les composants s'aiguillent par préfixe d'identifiant.** Un bouton
`musique:stop` désigne la commande `musique` ; `index.js` découpe sur `:` et appelle
son export `composant`. Aucune table de correspondance à tenir à jour : une commande
qui veut des boutons exporte `composant` et préfixe ses `custom_id`, c'est tout.

**Le panneau ne vit pas dans la session, et c'est délibéré.** `Session` n'expose
plus que `surChangement` : le point d'accroche, sans quoi le panneau mentirait dès
qu'une piste s'enchaîne toute seule. Le message lui-même est dans une `Map` de
module de `commands/musique.js` (`guildeId → { message, maitre }`), même patron que
`navigation.js`. Deux raisons mesurées : on doit pouvoir **ouvrir le panneau sans
être en vocal**, donc sans session ; et la session est détruite dès que le salon se
vide, ce qui laissait un panneau à l'écran que plus rien ne pouvait rafraîchir.
Pendant le traitement d'un clic, le `guildeId` entre dans le `Set` `muets` pour que
l'affichage soit fait une seule fois, par la réponse à l'interaction.

**`/musique` n'exige pas le salon vocal.** `execute()` appelait `rejoindre()`
d'emblée : la propriété « feuilleter sans être en vocal », écrite noir sur blanc
dans `panneau.js` et dans le tri des actions de `composant()`, n'était atteignable
par aucun chemin. Le bot ne vient que si le membre est déjà en vocal ; sinon le
panneau se pose avec `s = null`, ce que `rendu()` sait dessiner depuis toujours.

**Le panneau se replace quand il est enterré.** `/musique` répondait « déjà
ouvert : *url* », ce qui laissait le panneau trois cents messages plus haut après
deux heures de séance. On regarde maintenant s'il est encore le dernier message du
salon (`messages.fetch({ limit: 1 })`) : oui, on l'édite ; non, on en poste un neuf
et on efface l'ancien. **Un bot supprime ses propres messages sans « Gérer les
messages »** — vérifié avant d'écrire la ligne, la liste des huit permissions ne
bouge pas. La vue de navigation n'est remise à zéro que s'il n'y avait aucun
panneau : un replacement ne doit pas faire perdre la page où l'on en était.

**La lecture appartient au maître du panneau.** Choix d'Ilphrinn le 26 août : celui
qui lance `/musique` est le seul à commander jouer, pause, volume, boucle, arrêt.
La navigation (`lieu`, `majeure`, `page±`) reste ouverte à tous — c'est la même
liste que celle des actions qui n'exigent pas de session, et pour la même raison :
regarder ne touche à rien. Reprise possible seulement si le maître a quitté le
salon vocal du bot, sinon sa déconnexion bloquerait la musique jusqu'au
redémarrage. Un panneau laissé par un lancement précédent du bot n'a plus de
maître connu : il n'appartient à personne, et la première `/musique` le reprend.

**Une commande peut exporter `arret()`.** Nouvelle convention de chargement, dans
l'esprit des autres (`composant`, `autocomplete`) : aucune table à tenir.
`index.js` appelle `arret()` sur toutes les commandes avant de mourir, après
`toutQuitter()` — quitter le vocal est plus urgent que d'écrire un message.
`musique.arret()` remplace le panneau par « je redémarre », sans boutons : sinon un
redéploiement laissait un panneau figé sur « ▶️ En lecture » dont les boutons
répondaient « Je ne joue rien », ce qui fait chercher une panne là où il n'y a
qu'un déploiement. **Un `SIGKILL` laisse le fantôme** — on ne peut rien y faire
sans persistance, et il n'y a pas de base. C'est écrit dans le README plutôt que
caché.

**Le panneau est un message de salon, pas une réponse d'interaction.** C'était
`interaction.fetchReply()` ; ce message appartient au jeton de l'interaction, qui
**expire au bout de quinze minutes**. Passé ce délai chaque `edit()` échouait,
`surChangement` mettait `panneau` à `null`, et le panneau se figeait sans un mot —
panne invisible tant que rien ne se rafraîchissait tout seul, et criante dès qu'une
barre de progression avance toutes les dix secondes. `execute()` répond donc en
éphémère et poste le panneau avec `channel.send()`. **N'y reviens pas** : ce n'est
pas une préférence de mise en page, c'est la seule forme qui vit une séance entière.
Relancer `/musique` dans le même salon réutilise le panneau posé plutôt que d'en
empiler un deuxième.

**L'affichage graphique se dessine en caractères, délibérément.** Barre de
progression et jauge de volume en `▰▱`, dans `lib/panneau.js`. Deux voies écartées
en connaissance de cause : les **Composants V2** (voir plus bas, la raison n'a pas
changé), et une **image PNG** dessinée à la volée — il faudrait une bibliothèque
graphique native, et surtout re-téléverser le fichier à chaque rafraîchissement,
six fois par minute. Les caractères coûtent une édition de message, rien de plus.

**Le rangement se lit dans le chemin, il ne s'hérite plus.** `parcourir()`
héritait la catégorie du dossier de tête (`categorie ?? e.name`), ce qui aplatissait
tout : `ambiance/chenlin/x.ogg` ressortait en `ambiance`, le lieu perdu. Le
découpage se fait maintenant sur l'`id` — premier segment la **majeure**, deuxième
le **lieu**, `null` pour une piste posée à la racine d'une majeure (« Partout »).
**Deux paliers, pas trois** : plus profond, la piste reste rattachée à son lieu.
`categorie` reste égal à `majeure`, uniquement parce que la recherche d'émoji s'en
sert encore ; ne t'appuie pas dessus pour du neuf.

**Les lieux sont des slugs sur le disque, et une table dans le code.**
`src/lib/lieux.js` tient nom affiché, glose, ordre et le drapeau « proposé ».
Deux raisons, toutes deux mesurées : un tri alphabétique perdrait la numérotation
des douze régions, et un dossier nommé `Portes de l'Enfer` traverserait git,
Docker et Railway sans qu'on ait pu le vérifier. **En `lib/`, pas en `data/`** — un
motif d'ignore non ancré a déjà fait disparaître `src/data/` en silence. Un dossier
absent de la table n'est pas une erreur : il s'affiche sous son slug, en fin de
liste. Ajouter une région, c'est une ligne et un dossier.

**La vue du navigateur ne peut pas vivre dans la session.** `lib/navigation.js`
tient `{ majeure, lieu, page }` dans une `Map` de module, clé `guildeId` — même
patron que la mémoire des pochettes. Deux raisons : on doit pouvoir feuilleter la
bibliothèque **sans être en vocal**, et la session est détruite dès que le salon se
vide, ce qui effacerait la vue à chaque silence. `selection()` corrige au passage
une vue devenue fausse (majeure disparue, lieu vidé, page au-delà du dernier écran)
— c'est le seul endroit qui connaisse la taille d'une page. Un redémarrage la vide
et le panneau repart en haut : assumé, un redéploiement coupe déjà la musique.

**Le bouton de majeure tourne, il n'y en a pas deux.** Comme celui de la boucle. Un
troisième dossier de tête reste ainsi atteignable sans nouveau bouton — et surtout
**les cinq rangées sont pleines** : deux menus, navigation, transport, bas. C'est
le plafond de Discord. Toute fonction de plus devra en déloger une autre ; c'est ce
qui interdit aujourd'hui un bouton de recherche.

**Choisir un lieu ne joue rien.** `lieu`, `majeure`, `page-` et `page+` ne
demandent ni session ni salon vocal : c'est tout l'intérêt d'un navigateur. Seules
`jouer` et `piste` appellent `rejoindre()`. Ne les rajoute pas au lot qui exige une
session — l'erreur « Je ne joue rien pour le moment » serait un contresens sur un
clic de navigation.

**La durée se sonde avec `ffmpeg -i`, pas avec `ffprobe`.** `ffmpeg-static` ne
livre que le binaire `ffmpeg`, et le Dockerfile n'installe que le paquet `ffmpeg` :
`ffprobe` marcherait sur cette machine et nulle part ailleurs. `ffmpeg -i <fichier>`
sans sortie échoue, mais il a déjà imprimé `Duration:` sur stderr — c'est ce qu'on
lit (`lib/duree.js`). Vérifié le 26 août sur `cloche-longue.ogg` : 45 010 ms.
Cache par `chemin + mtime`, sonde asynchrone lancée **sans être attendue** : la
lecture ne doit jamais dépendre d'un `spawn`. Durée illisible ⇒ `null`, et le
panneau montre le temps écoulé sans barre. **Une durée inconnue n'est pas une
erreur** — ne la transforme pas en message d'avertissement.

**Le fondu est séquentiel, pas enchaîné.** `inlineVolume` était déjà là : une
rampe sur `setVolume` suffit, un seul lecteur, les pistes ne se recouvrent jamais.
Ce n'est donc **pas** le fondu enchaîné écarté plus bas — celui-là demande deux
lecteurs et un mélange, et reste écarté. Trois moments : entrée de piste, coupure
voulue (`suivant()`, `stop()`, qui sont devenues `async` pour ça), et fin naturelle
d'une piste **dont la durée est connue**. Ce dernier cas s'arme sur un `setTimeout`,
y compris dans le `.then()` de la sonde de durée — sans quoi il ne s'armerait jamais
pour une piste jouée avant que ffmpeg n'ait répondu. Une pause décale la fin réelle :
plutôt qu'une deuxième minuterie pour la suivre, le fondu **se recale** au moment de
partir en relisant `position`, qui ne ment pas.

`rampe()` est exportée de `lib/musique.js` uniquement pour que `verif` puisse la
vérifier hors ligne. Sa minuterie est `unref` — un fondu ne doit pas retenir le
processus au moment de mourir —, donc `verif` tient lui-même la boucle d'évènements
ouverte le temps de la mesure. Sans ça, Node sort avant la fin de la rampe et
l'`await` ne se résout jamais.

**Le volume envoyé est un produit de trois choses** : `volume` (le réglage
d'Ilphrinn), `gain` (la correction de niveau de la piste) et `attenuation` (l'état
du fondu, de 0 à 1). Chacun bouge de son côté, `#appliquerVolume()` recompose. C'est
ce qui permet de régler le volume **pendant** un fondu sans que l'un écrase l'autre.
**La jauge du panneau montre `volume` seul** — le réglage, pas la correction. Ne
l'expose pas au produit : Ilphrinn ne comprendrait pas pourquoi sa jauge bouge toute
seule.

**Le niveau se mesure avec `volumedetect`, sur le patron exact de `duree.js`.**
Même geste éprouvé : `spawn` de ffmpeg, lecture de stderr, cache par
`chemin + mtime`, promesse mise en cache pour ne pas lancer deux sondes. Deux
différences, toutes deux dans `lib/niveau.js` et commentées sur place : **le résumé
n'arrive qu'à la toute fin** du flux, donc on garde la queue de stderr et non sa
tête ; et **volumedetect décode le fichier entier** — une à trois secondes de
processeur par piste. D'où : jamais attendu, jamais lancé sur toute la bibliothèque
au démarrage, et `prevoir()` sur la piste suivante de la file pendant que la
précédente joue. En pratique seule la toute première piste d'une séance est
corrigée en cours de route, et par une glissade d'une seconde, pas par un saut.

Le gain est plafonné à ±12 dB et borné par la crête (`max_volume + gain ≤ −1 dB`) :
c'est cette seconde borne qui évite d'écrêter une piste au niveau moyen bas mais aux
pics forts. Mesure illisible ⇒ gain de 1. **Un niveau inconnu n'est pas une erreur**,
exactement comme une durée inconnue — ne le transforme pas en avertissement. Le
cache est en mémoire, donc perdu au redémarrage : une sonde par piste jouée et par
session, ça suffit. Pas de fichier de cache — le disque de Railway est éphémère.

**La pochette n'est renvoyée qu'au changement.** Une édition de message qui ne
parle ni de `files` ni de `attachments` conserve la pièce jointe déjà en place :
c'est ce qui permet de faire avancer la barre sans re-téléverser l'image. Une Map
`guildeId → chemin affiché` dans `lib/panneau.js` tient cette mémoire, et
`oublierPochette()` la vide quand on poste un panneau neuf. Si tu touches au
rendu, garde cette distinction — sinon l'image repart toutes les dix secondes.

**Le panneau ne ment pas sur l'état du lecteur.** `NoSubscriberBehavior.Pause`
met le lecteur en `AutoPaused` quand le salon se vide : l'afficher comme une pause
volontaire ferait chercher qui a cliqué. D'où quatre états distincts, dont « en
veille — personne n'écoute ».

**La minuterie du panneau ne réédite que si quelque chose a bougé.** Pas en
lecture, ou durée inconnue : on ne dépense pas de requête. Dix secondes par défaut
(`PANNEAU_SECONDES`) ; en dessous de cinq, Discord finit par limiter les éditions.

**Les erreurs remontent.** Dans une commande, `throw new Error('phrase lisible en
français')` : le gestionnaire d'`interactionCreate` dans `index.js` l'attrape et la
renvoie en éphémère. N'attrape pas localement pour reformater.

**`crypto.randomBytes` avec rejet, pas `Math.random`.** Pour des dés à une table de
JDR, c'est gratuit et ça coupe court aux discussions.

**Le raccourci de `/d` appartient à la commande, pas à l'analyseur.** `/d 6` vaut
`1d6`, mais pour `lib/des.js` le `6` de `2d6+3` reste une constante — c'est correct.
La conversion ne se fait que si l'expression entière n'est qu'un nombre, et elle est
dans `lib/commande-des.js`, partagée par les deux noms. Ne la descends pas
dans le moteur.

**Un argument de commande ne peut pas être anonyme.** Ilphrinn a demandé que
l'étiquette disparaisse de la barre de saisie. Ce n'est pas possible, et c'est
vérifié plutôt que supposé : l'espace nu et l'insécable sont refusés par la
validation de discord.js, et U+3164 — le remplisseur hangul, que discord.js
accepte parce qu'Unicode le classe comme une lettre — se fait rejeter par l'API
en `STRING_TYPE_REGEX` + `BASE_TYPE_BAD_LENGTH`. Le nom est donc `jet`, dans
`NOM_ARGUMENT` ([`lib/commande-des.js`](src/lib/commande-des.js)). **N'y reviens
pas** : c'est une limite ferme de Discord, pas un contournement à trouver.

**L'affichage d'un jet ne dit que ce qui apprend quelque chose.** Un dé unique
sans modificateur n'affiche que son total. Le détail n'apparaît qu'à partir de
deux dés, d'un modificateur ou de dés écartés — sinon on ne saurait pas ce qui a
été gardé. La version précédente écrivait la notation deux fois (`1d20 → 1d20
[14]`), ce qu'Ilphrinn a relevé à juste titre.

**Les émojis de dés se cherchent par nom, jamais par identifiant.**
`guilde.emojis.cache.find((e) => e.name === 'd20')`. Rien à coder en dur, rien à
reconfigurer si le serveur change, et si l'émoji n'a pas été téléversé le bot
retombe sur le 🎲 sans un mot.

**L'émoji désigne le dé lancé, pas le résultat.** Première version : une image
par face de d6 (`d6_1`… `d6_6`). Ilphrinn voulait en fait le jeu classique — un
dé par type, `d2 d4 d6 d10 d12 d20`. C'est mieux : ça vaut pour `3d6` comme
pour `1d6`. La règle exige que tout le jet porte sur un seul type, sinon
l'image mentirait sur ce qui a été lancé.


**Un émoji par dé, et `des.js` expose le détail pour ça.** Ilphrinn a relevé
qu'un seul émoji pour `3d20` ne dit pas qu'il y a eu trois jets. Le moteur ne
rendait le détail que sous forme de chaîne déjà mise en forme (`detail`), donc
`evaluer()` retourne désormais aussi **`termes`** : chaque terme dans l'ordre
écrit, chaque dé avec sa valeur et son sort (gardé ou écarté), le signe et la
constante. `detail` reste, la forme compacte s'en sert encore. Si tu touches à
l'affichage, pars de `termes`, jamais d'une chaîne à re-découper.

**Le plafond de douze dés n'est pas esthétique, il est technique.** Un émoji
personnalisé s'écrit `<:d20:1541…>`, soit une vingtaine de caractères ; le
moteur accepte cent dés ; un message Discord est limité à 2000 caractères. Au
delà de `MAX_DES_DETAILLES`, on repasse à la forme compacte, précédée de
l'émoji `Power` — le nom vient d'Ilphrinn, aucune image n'est fournie pour
celui-là.

**Tout dé est accepté, même inexistant** — `1d27`, `1d1000` marchent, voir la
règle de composition plus bas. C'est aussi ce qui rend les jets mêlés
(`1d6+1d20`) lisibles sans règle particulière : chaque dé porte son propre
symbole, il n'y a plus de contrainte « un seul type par jet ».

La recherche d'émoji est **insensible à la casse** : Discord conserve la casse
du nom de fichier au téléversement, et échouer en silence sur un « P » serait
pénible à diagnostiquer.


**Un dé sans icône propre s'écrit comme une SOMME de dés existants.** `d26`
devient `d20`+`d6`, `d8` devient `d6`+`d2`, `d30` devient `d20`+`d10`. Glouton,
du plus grand au plus petit, exact — une approximation mentirait — et plafonné à
six pièces — plafond fixé par Ilphrinn, il couvre jusqu'au `d120`. C'est lui qui a demandé
ce comportement, après avoir refusé le 🎲 générique.

Effet secondaire heureux : le d8, dont l'image manque, n'en a plus besoin.


**Les jets sont séparés par une tabulation**, choix d'Ilphrinn — le `·` était
trop discret entre deux icônes. Discord rend le contenu des messages en
`white-space: pre-wrap`, la tabulation est donc conservée et non réduite à une
espace. Si l'écart paraît malgré tout trop mince chez lui, c'est `separateur`
dans [`lib/commande-des.js`](src/lib/commande-des.js), une ligne.

**Compter les dés ne suffit pas à tenir la limite de 2000 caractères.** Un dé
composé porte jusqu'à six icônes, et un émoji personnalisé s'écrit
`<:d20:1541805417653477499>` — vingt-cinq caractères. Douze dés ainsi composés
font environ 1930 caractères. On **mesure donc la ligne produite** avant de
l'envoyer, et on repasse en forme compacte si elle dépasse `LIMITE_MESSAGE`.
Vérifié : `12d110` bascule, `10d110` passe à 1609.

**Quand la somme est impossible, on prend le `d6`**, sur sa demande — un vrai dé
plutôt qu'un pictogramme dépareillé. Tous les dés impairs y tombent, et c'est
arithmétique : les six dés illustrés ont un nombre pair de faces, donc leur
somme l'est toujours. `d3`, `d5`, `d7`, `d27` sont hors d'atteinte. Conséquence
assumée et signalée : un `d27` ressemble à un `d6`.

**Il n'y a plus de rappel de notation en fin de ligne.** Il avait été ajouté
pour lever l'ambiguïté sur les dés sans image ; Ilphrinn l'a trouvé encombrant
et la décomposition l'a rendu presque inutile. Ne le remets pas.

**Le d100 n'a pas d'image, et il ne faut pas lui en inventer une.** J'avais
d'abord recyclé celle du d10 ; Ilphrinn a eu raison de le refuser, c'était du
bricolage déguisé en décision. Il n'existe aucune icône de percentile — vérifié
sur le site *et* dans le dépôt amont `game-icons/icons`, pour les trois auteurs.
Le bot affiche donc **deux fois l'émoji du d10**, ce qu'on lance réellement.
Aucun fichier de plus, et c'est plus juste qu'une approximation.

Ne tente pas de composer une image toi-même : ces PNG sont en palette **et
entrelacés (Adam7)**, donc les décoder demande bien plus que `zlib.inflate`, et
il n'y a aucun outil de retouche sur cette machine — `convert` est le
convertisseur de volumes de Windows, pas ImageMagick.

**Le d8 manque.** game-icons.net renvoie un 403 constant sur ce seul icône en
fond transparent, alors que ses voisins passent, et sert du HTML à la place du
PNG. Le fichier a été rejeté sur sa signature, pas sur sa taille : **vérifie les
octets d'en-tête avant de croire un téléchargement.** Le SVG existe pourtant
dans le dépôt amont — c'est bien un défaut de leur générateur.

Images de Delapouite et Skoll via game-icons.net, CC BY 3.0 : l'attribution est
due, ne supprime pas le `LISEZ-MOI.txt`. Elles sont blanches sur transparent :
très bien sur le thème sombre, faibles sur le thème clair. Aucun outil de
retouche d'image sur cette machine — `convert` est le convertisseur de volumes
de Windows, pas ImageMagick.

---

## Pièges rencontrés, à ne pas re-découvrir

**L'entrée ESM de `libsodium-wrappers` est cassée en amont.** Son
`dist/modules-esm/libsodium-wrappers.mjs` fait `import e from "./libsodium.mjs"` —
un chemin *relatif* vers un fichier qui appartient au paquet voisin `libsodium` et
que son champ `files` ne livre pas. `import sodium from 'libsodium-wrappers'` échoue
donc systématiquement en `ERR_MODULE_NOT_FOUND`, sur toute plateforme. `index.js`
passe par `createRequire` : la version CommonJS, elle, résout correctement. Le
commentaire sur place le dit — ne le retire pas sans avoir vérifié que l'amont a
corrigé son paquet (0.8.x reste à vérifier ; je n'ai pas pu le confirmer).

Ce bug a survécu à toute la première session parce que `npm run verif` faisait
`node --check` sur `index.js` — la syntaxe, pas l'exécution — et que le rapport de
dépendances de `@discordjs/voice` interroge les paquets par `require`. **Une
dépendance « présente » au rapport n'est pas une dépendance qui s'importe.** `verif`
refait désormais le geste réel du démarrage.

**Un motif d'ignore sans barre oblique initiale matche à toute profondeur.**
`.gitignore` contenait `data/`, ce qui excluait aussi `src/data/` : `hexagrammes.js`
et `noms.js` n'ont jamais été commités, et `.dockerignore` avait le même défaut avec
sa ligne `data`. Sur Railway, `oracle.js` et `pnj.js` auraient échoué à l'import
juste après la correction de `libsodium` — une deuxième boucle d'échec, pour une
raison sans rapport. Les deux motifs ont disparu avec la base de données. **Si tu
réintroduis un dossier ignoré, ancre-le : `/data/`, pas `data/`.**

**L'outil Bash consomme un niveau d'échappement.** Un heredoc contenant `\'` ou
`\\u0300` arrive déformé côté fichier. Pour tout fichier contenant des antislashs,
des apostrophes échappées ou des séquences Unicode, **utilise l'outil Write**, pas
`cat <<EOF` — un heredoc entre quotes simples se casse quand même sur du contenu
long. C'est pour ça que `des.js` utilise `/\p{Diacritic}/gu` : lisible, sans
caractère combinant littéral dans la source.

**npm 11.19 bloque les scripts d'installation.** `ffmpeg-static` n'avait pas
téléchargé son binaire ; il a fallu `npm install-scripts approve ffmpeg-static`, ce
qui a écrit `allowScripts` dans `package.json`. L'entrée est **épinglée à la
version** (`ffmpeg-static@5.3.0`) : si le paquet monte de version, l'approbation ne
correspond plus et le binaire ne se télécharge plus. En Docker, ça n'a aucune
importance — `FFMPEG_PATH=/usr/bin/ffmpeg` pointe sur le ffmpeg du système.

**Pas de binaire précompilé de `@discordjs/opus` pour Node 26 sous Windows.** D'où
son passage en `optionalDependencies`, avec `opusscript` (JS pur, plus gourmand) en
secours local. Le Dockerfile, lui, installe `python3 make g++` dans l'étape de
compilation pour obtenir la version native. Ne remonte pas `@discordjs/opus` dans
`dependencies` : `npm install` échouerait à nouveau sur la machine d'Ilphrinn.

**`ephemeral: true` est déprécié** en discord.js 14.27 → `flags: MessageFlags.Ephemeral`.
De même `setDMPermission` → `setContexts(InteractionContextType.Guild)`.

---

## Architecture, en une minute

`index.js` charge les commandes (`lib/chargeur.js` parcourt `src/commands/`, un
fichier = une commande exportant `{ data, execute, composant?, autocomplete? }`) et
aiguille les interactions, y compris les clics par préfixe d'identifiant. Ajouter une
commande : déposer le fichier, puis `npm run commandes`.

`lib/musique.js` tient une `Session` par serveur : connexion vocale, lecteur, file
d'attente, volume, mode de boucle, minuterie d'inactivité, et le point d'accroche du
panneau. Une seule session par serveur — rejoindre un autre salon détruit la
précédente. Le lecteur reçoit un chemin de fichier, ffmpeg fait le décodage ;
`inlineVolume` permet de régler le volume à chaud, au prix d'un passage par du PCM.
Il tient aussi la bibliothèque : `bibliotheque()` (cache de 30 s), `majeures()` et
`lieux(majeure)` — ces deux-là ne rendent que ce qui contient au moins une piste.

`lib/lieux.js` est la table des dix-huit lieux, `lib/navigation.js` la vue du
panneau (majeure, lieu, page) et `lib/panneau.js` son dessin. Le sens de lecture :
`panneau.js` appelle `selection()` et ne décide de rien lui-même.

`npm run verif` est un diagnostic **hors ligne** : il pose un faux jeton, charge
tout, valide les JSON de commandes, refait le chargement de libsodium et imprime le
rapport de dépendances audio. C'est le premier réflexe après une modification.

`npm run connexion` est le pendant **en ligne** : trois requêtes qui séparent
« jeton refusé », « mauvais `DISCORD_APPLICATION_ID` » et « bot pas encore invité ».
La deuxième panne est silencieuse sans lui — les commandes se déclarent sur une
autre application et n'apparaissent jamais.

---

## Ce que j'ai laissé de côté, sciemment

- **Le fondu enchaîné** entre deux ambiances, au sens strict — deux pistes qui se
  recouvrent. Le fondu séquentiel est fait (voir plus haut) et couvre l'essentiel ;
  l'enchaîné demanderait deux lecteurs et un mélange, pour un gain mince.
- **Le jet caché du meneur** (`/d … secret`, réponse éphémère) : une dizaine de
  lignes, proposé le 26 août et écarté par Ilphrinn faute d'usage immédiat. C'est
  le manque le plus classique d'un bot de dés — s'il en reparle, c'est court.
- **La reprise de lecture après un redéploiement.** Le bot laisse maintenant un mot
  sur le panneau avant de partir, mais il ne reprend pas où il en était : il
  faudrait mémoriser salon et piste quelque part, et il n'y a pas de base — ce
  serait donc un fichier ou une variable d'environnement.
- **La recherche par texte** dans la bibliothèque. `rechercher()` existait,
  accent-insensible et déjà plafonnée à 25 ; elle était morte depuis l'élagage et
  a été supprimée avec la navigation. Elle est dans l'historique git si le sujet
  revient — mais il faudra libérer une rangée, ou passer par une fenêtre modale.
- **Les Composants V2** (`ContainerBuilder` et compagnie, disponibles en 14.27).
  Le panneau est un embed classique avec des rangées de boutons — éprouvé et
  prévisible. On pourra passer aux Composants V2 quand le bot aura tourné pour de
  vrai ; pas avant, parce qu'on ne peut pas en vérifier le rendu hors ligne. La
  demande d'« affichage graphique » du 26 août a été tenue sans eux, en caractères
  et en pochettes ; ils donneraient une plus belle mise en page, pas plus
  d'information.
- **Le lien avec `Besoin/DISCORD.md`** : il y décrit l'export de son historique
  Discord vers du JSON pour alimenter ses fiches. Il n'a rien demandé de tel —
  attends qu'il en parle.

## Sur l'hébergement

Il est sur Railway, déployé depuis GitHub (`Ilphrinn/Taibai_Jinxing` — le dépôt a été
renommé le 26 août, l'ancien nom `Tabai_Jinxing` redirige encore). Je lui ai dit
franchement que le gratuit de Railway n'existe plus vraiment, estimé sa consommation
à 3–4 $/mois, **et signalé que je n'avais pas pu vérifier ces tarifs depuis cette
machine**. Garde cette réserve : ne présente jamais un prix de mémoire comme un fait
vérifié.

Le vrai point de friction n'est pas le prix mais **l'acheminement des fichiers
audio** : le `Dockerfile` fait `COPY assets ./assets`, donc il faut que les musiques
soient dans le dépôt, ce que `.gitignore` empêche aujourd'hui. Les `.gitkeep`
sauvent l'arborescence — l'image contiendrait donc trente-six dossiers **vides** et
un panneau qui dit « Aucun fichier », sans que rien n'explique pourquoi. C'est
pour ça que le démarrage le crie maintenant en `log.warn` au lieu de le glisser
dans une ligne d'info.

**Ne conseille pas Git LFS sans l'avoir vérifié.** Le README le faisait ; une
construction Docker ne récupère pas les objets LFS d'elle-même, et l'image se
retrouverait avec des pointeurs de 132 octets — *toutes* les pistes échoueraient à
la lecture. Je n'ai pas pu vérifier depuis cette machine ce que Railway en fait :
la réserve est écrite telle quelle dans le README, et `verif` reconnaît désormais
ces pointeurs (taille < 200 octets, en-tête `version https://git-lfs`) et les
compte comme un problème.

La règle donnée : moins de ~300 Mo, dans le dépôt sans LFS ; au-delà, un VPS à 4 €
devient plus simple *et* moins cher. Et le levier qu'il ne faut pas oublier de
mentionner : convertir en `.ogg` à 96–128 kb/s divise la taille par trois ou
quatre, sans différence audible sur un fond sonore que Discord ré-encode de toute
façon en Opus.
