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
Lancé avec un jeton bidon, `src/index.js` va jusqu'à `TokenInvalid` — ce qui prouve
tout le chemin de démarrage sauf la connexion elle-même.

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

**Le panneau de `/musique` a un point d'accroche dans la session.** `Session` expose
`panneau` et `surChangement` ; la commande y branche un rafraîchissement. Sans ça,
le panneau mentirait dès qu'une piste s'enchaîne toute seule. Pendant le traitement
d'un clic, on met `panneau` à `null` pour que l'affichage soit fait une seule fois,
par la réponse à l'interaction — puis on raccroche.

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
trois pièces au-delà desquelles ça ne se lit plus. C'est Ilphrinn qui a demandé
ce comportement, après avoir refusé le 🎲 générique.

Effet secondaire heureux : le d8, dont l'image manque, n'en a plus besoin.

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

`npm run verif` est un diagnostic **hors ligne** : il pose un faux jeton, charge
tout, valide les JSON de commandes, refait le chargement de libsodium et imprime le
rapport de dépendances audio. C'est le premier réflexe après une modification.

`npm run connexion` est le pendant **en ligne** : trois requêtes qui séparent
« jeton refusé », « mauvais `DISCORD_APPLICATION_ID` » et « bot pas encore invité ».
La deuxième panne est silencieuse sans lui — les commandes se déclarent sur une
autre application et n'apparaissent jamais.

---

## Ce que j'ai laissé de côté, sciemment

- **La reprise de lecture après redéploiement.** Aujourd'hui un redéploiement coupe
  la musique. Il faudrait mémoriser salon et piste quelque part — mais il n'y a plus
  de base, donc ce serait un fichier ou une variable d'environnement.
- **Le fondu enchaîné** entre deux ambiances : deux lecteurs et un mélange, plus de
  code qu'il n'y paraît.
- **Les menus au-delà de 25 pistes.** Discord plafonne ; il faudrait paginer.
- **Les Composants V2** (`ContainerBuilder` et compagnie, disponibles en 14.27).
  Le panneau est un embed classique avec des rangées de boutons — éprouvé et
  prévisible. On pourra passer aux Composants V2 quand le bot aura tourné pour de
  vrai ; pas avant, parce qu'on ne peut pas en vérifier le rendu hors ligne.
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
soient dans le dépôt, ce que `.gitignore` empêche aujourd'hui. Si sa bibliothèque
dépasse quelques centaines de mégaoctets, un VPS à 4 € devient plus simple et moins
cher — c'est écrit dans le README, sans insistance.
