# Note pour un futur moi

Bot Discord pour la table de JDR en Chine mythologique d'Ilphrinn. Écrit le
25 août 2026, d'un seul jet, sur un dossier qui ne contenait que `Besoin/DISCORD.md`.
Ce fichier dit **pourquoi** les choses sont ainsi ; le `README.md` dit comment s'en
servir. Lis les deux avant de toucher quoi que ce soit.

---

## État réel au moment où j'écris

**Vérifié :** les 8 commandes se chargent et leur JSON respecte les limites de
Discord (`npm run verif`), le moteur de dés, la table du Roi Wen (bijection sur
1–64, repères 1/2/63/64 justes), le calcul du bitfield de permissions, la chaîne
audio (opusscript + libsodium + ffmpeg 6.1.1 avec libopus).

**Jamais exécuté :** le bot ne s'est **pas encore connecté à Discord**. Il n'y a ni
jeton, ni application Discord, ni fichier audio dans `assets/musique/`. Donc rien du
chemin vocal — `joinVoiceChannel`, la lecture, les webhooks de PNJ — n'a tourné en
conditions réelles. Le Dockerfile n'a pas été construit non plus (pas de Docker sur
la machine). Si quelque chose casse au premier lancement, c'est là qu'il faut
chercher en premier, pas dans la logique.

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
  joueurs gardent leurs accents et leurs guillemets français.
- **Dans les `.md` et les descriptions de commandes** : français complet, accentué.

---

## Décisions structurantes

**`node:sqlite` plutôt que `better-sqlite3`.** Le module natif de Node depuis la
22.5 : zéro dépendance à compiler, ce qui supprime la classe entière de pannes
node-gyp au déploiement. Impose `node >= 24` (avant la 23.4 il fallait un drapeau).
Le Dockerfile est donc sur `node:24-slim` — ne le rétrograde pas.

**Aucun intent privilégié.** Uniquement `Guilds` et `GuildVoiceStates`. Le bot ne
lit aucun message : tout passe par les commandes `/`. Rien à activer dans le portail
développeur, et pas de vérification Discord à cent serveurs. Si tu ajoutes une
fonction qui réclame `MessageContent`, sache que tu casses cette propriété — pèse-la.

**`src/lib/permissions.js` est la source unique du lien d'invitation.** Le bitfield
(`396134575424`) est calculé par discord.js à partir de cette liste, jamais saisi à
la main. Si tu changes la liste, régénère le lien **et** le nombre écrit dans le
README, sinon les deux divergent en silence.

**Les erreurs remontent.** Dans une commande, `throw new Error('phrase lisible en
français')` : le gestionnaire d'`interactionCreate` dans `index.js` l'attrape et la
renvoie en éphémère. N'attrape pas localement pour reformater, sauf cas particulier
(voir le code 10015 dans `voix.js`, webhook supprimé entre-temps).

**`crypto.randomBytes` avec rejet, pas `Math.random`.** Pour des dés à une table de
JDR, c'est gratuit et ça coupe court aux discussions.

**Les cinq mouvements (五行) comme attributs.** Choix thématique, pas imposé par
Ilphrinn : je ne connais pas son système de jeu. Il n'a rien dit là-dessus — s'il
en a déjà un, `perso.js`, `db.js` et `couleurs.js` sont à revoir ensemble. Ne
défends pas ce choix : c'était un défaut raisonnable, rien de plus.

---

## Pièges rencontrés, à ne pas re-découvrir

**L'outil Bash consomme un niveau d'échappement.** Un heredoc contenant `\'` ou
`\\u0300` arrive déformé côté fichier — ça m'a coûté deux échecs sur `musique.js`.
Pour tout fichier contenant des antislashs, des apostrophes échappées ou des
séquences Unicode, **utilise l'outil Write**, pas `cat <<EOF`. C'est pour ça que
`des.js` utilise `/\p{Diacritic}/gu` : lisible, sans caractère combinant littéral
dans la source.

**npm 11.19 bloque les scripts d'installation.** `ffmpeg-static` n'avait pas
téléchargé son binaire ; il a fallu `npm install-scripts approve ffmpeg-static`, ce
qui a écrit `allowScripts` dans `package.json`. L'entrée est **épinglée à la
version** (`ffmpeg-static@5.3.0`) : si le paquet monte de version, l'approbation ne
correspond plus et le binaire ne se télécharge plus. En Docker, ça n'a aucune
importance — `FFMPEG_PATH=/usr/bin/ffmpeg` pointe sur le ffmpeg du système. C'est
seulement en local que ça peut mordre.

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
fichier = une commande exportant `{ data, execute, autocomplete? }`) et aiguille les
interactions. Ajouter une commande : déposer le fichier, puis `npm run commandes`.

`lib/musique.js` tient une `Session` par serveur : connexion vocale, lecteur, file
d'attente, volume, mode de boucle, minuterie d'inactivité. Une seule session par
serveur — rejoindre un autre salon détruit la précédente. Le lecteur reçoit un
chemin de fichier, ffmpeg fait le décodage ; `inlineVolume` permet de régler le
volume à chaud, au prix d'un passage par du PCM.

`npm run verif` est un diagnostic **hors ligne** : il pose un faux jeton, charge
tout, valide les JSON de commandes et imprime le rapport de dépendances audio. C'est
le premier réflexe après une modification, et il ne consomme aucun quota Discord.

---

## Ce que j'ai laissé de côté, sciemment

- **La reprise de lecture après redéploiement.** Aujourd'hui un redéploiement coupe
  la musique. Il faudrait mémoriser salon et piste dans la base.
- **Le fondu enchaîné** entre deux ambiances : deux lecteurs et un mélange, plus de
  code qu'il n'y paraît.
- **L'initiative et le combat** : rien, faute de connaître le système d'Ilphrinn.
- **Le lien avec `Besoin/DISCORD.md`** : il y décrit l'export de son historique
  Discord vers du JSON pour alimenter ses fiches. Une commande `/note` versant dans
  la même base ferait la jonction. C'est l'extension la plus évidente, et il n'a rien
  demandé de tel — attends qu'il en parle.

## Sur l'hébergement

Il est déjà sur Railway pour un autre bot, en gratuit. Je lui ai dit franchement que
le gratuit de Railway n'existe plus vraiment (crédit unique d'essai, puis Hobby à ~5 $),
estimé sa consommation à 3–4 $/mois, **et signalé que je n'avais pas pu vérifier ces
tarifs depuis cette machine**. Garde cette réserve : ne présente jamais un prix de
mémoire comme un fait vérifié.

Le vrai point de friction n'est pas le prix mais **l'acheminement des fichiers audio**.
Trois voies dans le README (image Docker, volume Railway, stockage objet). Si sa
bibliothèque dépasse quelques centaines de mégaoctets, un VPS à 4 € devient plus
simple et moins cher — c'est écrit, sans insistance.
