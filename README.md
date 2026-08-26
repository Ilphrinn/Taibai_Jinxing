# 太白金星 — Tàibái Jīnxīng

Bot Discord pour la table de jeu de rôle en Chine mythologique. Deux commandes :
les dés, et un panneau pour les musiques d'ambiance diffusées depuis des fichiers
rangés sur le serveur.

Il te manque trois choses : une application Discord, un jeton, et tes fichiers audio.

---

## 1. Mise en route

### Créer l'application

1. <https://discord.com/developers/applications> → **New Application**. Nomme-la
   « Taibai Jinxing ».
2. Onglet **Bot** → **Reset Token** → **Copy**. C'est le jeton. Il ne s'affiche
   qu'une fois ; si tu le perds, tu le réinitialises.
3. Onglet **General Information** → copie l'**Application ID**.

**Aucun intent privilégié à activer.** Le bot ne lit pas les messages : il ne
fonctionne qu'aux commandes `/` et aux boutons.

### Configurer

```bash
cp .env.exemple .env      # puis remplis DISCORD_TOKEN et DISCORD_APPLICATION_ID
npm install
npm run verif             # diagnostic hors ligne : rien ne se connecte
```

Renseigne aussi `DISCORD_GUILD_ID` avec l'identifiant de ton serveur de jeu
(mode développeur → clic droit sur le serveur → copier l'identifiant). Les
commandes y apparaissent alors instantanément au lieu d'attendre jusqu'à une
heure de propagation.

### Inviter, déclarer, lancer

```bash
npm run lien              # imprime le lien d'invitation, permissions détaillées
# ouvre le lien, invite le bot sur ton serveur, puis :
npm run connexion         # jeton, application, présence sur le serveur
npm run commandes         # déclare les commandes auprès de Discord
npm start
```

L'ordre compte : `npm run commandes` vise ton serveur et échoue si le bot n'y est
pas encore. `npm run connexion` te le dira avant Discord.

---

## 2. Le lien d'invitation

Remplace `TON_APPLICATION_ID` par ton Application ID :

```
https://discord.com/api/oauth2/authorize?client_id=TON_APPLICATION_ID&permissions=274914692096&scope=bot%20applications.commands
```

`npm run lien` produit exactement ce lien, avec ton identifiant. Le nombre
`274914692096` n'est pas saisi à la main : il est calculé par discord.js à partir
de [`src/lib/permissions.js`](src/lib/permissions.js).

Huit permissions, et **rien que ce que le code exerce réellement** :

| Permission | Pourquoi |
|---|---|
| Voir les salons, Envoyer des messages, Écrire dans les fils | toute réponse |
| Intégrer des liens | le panneau de `/musique` est un encart |
| Lire l'historique | retrouver le panneau pour le mettre à jour |
| **Se connecter, Parler, Détection de la voix** | **diffuser la musique** |

Ni `Administrator`, ni `Gérer les messages`, ni `Gérer les rôles` : le bot n'en a
pas besoin, et un jeton qui fuite fait alors beaucoup moins de dégâts.

`npm run lien` affiche aussi un **lien minimal** (`19456`) sans la voix, si tu veux
d'abord essayer `/d` en salon texte.

> Piège classique : « Se connecter » et « Parler » se vérifient **sur le salon
> vocal**, pas seulement sur le serveur. Un bot peut avoir la permission au niveau
> du serveur et se la voir refuser sur un salon précis.

---

## 3. Les commandes

### `/d` et `/r` — les dés

Deux noms pour la même chose : `/r` parce que c'est ce que les joueurs tapent
d'habitude. Un seul argument, insensible à la casse, tolérant aux espaces.

| Tu écris | Tu obtiens |
|---|---|
| `/d 6` | `1d6` — un nombre nu vaut un dé de ce nombre de faces |
| `/r 1d100` | trois chiffres, comme il se doit |
| `/d 3d100` | trois dés de cent |
| `/d 1D20` | la casse n'a aucune importance |
| `/d 2d6+3` | modificateurs, additions et soustractions |
| `/d 4d6kh3` | garde les 3 plus hauts (`kh`), `3d10kl1` garde le plus bas (`kl`) |

L'affichage ne dit que ce qui apprend quelque chose : un dé unique sans
modificateur donne son total, rien de plus. Dès qu'il y a plusieurs dés, un
modificateur ou des dés écartés, chaque dé apparaît séparément — sinon tu ne
saurais pas ce qui a été gardé :

```
/d 20        →  🎲 14
/d 3d20      →  🎲 15	🎲 1	🎲 12	→ 28
/d 2d6+3     →  🎲 2	🎲 4	+3	→ 9
/d 4d6kh3    →  🎲 2	🎲 3	🎲 ~~1~~	🎲 2	→ 7
```

Les jets sont séparés par une **tabulation**, les dés écartés barrés, les
extrêmes (1 et le maximum) en gras, et le total arrive après la flèche. Le 🎲
devient l'icône du dé concerné dès que tu as téléversé les émojis — voir plus
bas.

> **L'argument s'appelle `jet` et ne peut pas être anonyme.** Discord impose un
> nom à chaque option et l'affiche dans la barre de saisie. Testé le 26 août
> 2026 : l'espace est refusé, et les caractères « vides » comme U+3164 sont
> rejetés par l'API. Pour changer le libellé, une seule ligne dans
> [`src/lib/commande-des.js`](src/lib/commande-des.js).

**Les émojis de dés.** Téléverse les six images de `assets/emoji/` sur ton
serveur (Paramètres → Émojis → Importer, en gardant les noms de fichiers) et
chaque dé lancé s'affiche avec le sien : `d2`, `d4`, `d6`, `d10`, `d12`, `d20`.

```
/d 20          →  [d20] 14
/d 3d20        →  [d20] 15	[d20] 1	[d20] 12	→ 28
/d 2d6+3       →  [d6] 2	[d6] 4	+3	→ 9
/d 4d6kh3      →  [d6] 2	[d6] 3	[d6] ~~1~~	[d6] 2	→ 7
/r 1d100       →  [d10][d10] 73
/d 2d20-1d6+3  →  [d20] 3	[d20] 7	−[d6] 5	+3	→ 8
```

**Un émoji par dé** : c'est ce qui montre qu'il y a eu trois jets et non un
seul. Les jets sont séparés par une tabulation, les dés écartés par `kh`/`kl`
sont barrés, les extrêmes (1 ou face maximale) en gras, et le total arrive
après la flèche. Un dé seul sans modificateur n'affiche que son total — le
détail n'apprendrait rien.

Le bot cherche les émojis **par nom**, jamais par identifiant : rien à
configurer, et s'ils ne sont pas là il reprend le 🎲 sans que personne ne s'en
aperçoive.

**Tous les dés sont acceptés, même ceux qui n'existent pas** — et le bot leur
compose une icône **en additionnant les dés qu'il a** :

```
/d 1d26        →  [d20][d6] 7          26 = 20 + 6
/d 1d8         →  [d6][d2] 4           8 = 6 + 2
/d 1d30        →  [d20][d10] 28        30 = 20 + 10
/d 1d14        →  [d12][d2] 7          14 = 12 + 2
```

La somme doit tomber juste — une approximation mentirait sur ce qui a été
lancé — et s'arrête à six icônes, ce qui couvre jusqu'au `d120`.

**Quand la somme est impossible, c'est le `d6` qui prend le relais** — un vrai
dé plutôt qu'un pictogramme dépareillé. Ça concerne d'abord les dés impairs, et
c'est une impossibilité arithmétique, pas un oubli : les six dés illustrés ont
tous un nombre pair de faces, donc leur somme est toujours paire. `d3`, `d5`,
`d7`, `d27` ne peuvent pas être composés. Ça concerne aussi les très grands,
comme `d1000`.

À assumer : un `d27` ressemblera donc à un `d6`. Le nombre affiché lève
l'ambiguïté, mais l'icône, non.

**Au-delà de douze dés**, le détail passe en forme compacte, précédé de
l'émoji `Power` s'il existe sur le serveur. Ce n'est pas de la coquetterie :
un émoji personnalisé pèse une vingtaine de caractères, et le moteur accepte
jusqu'à cent dés — cent émojis dépasseraient la limite de 2000 caractères d'un
message Discord.

La ligne produite est aussi **mesurée** avant l'envoi : un dé composé peut
porter six icônes, et douze dés de ce genre frôleraient la limite. Si ça
déborde, on repasse en forme compacte, quel que soit le nombre de dés.

```
/d 20d6        →  [Power] 59  ·  20d6 [4, 1, 2, 3, 6, …]
```

Le `d100` n'a volontairement pas d'image : il n'existe aucune icône de
percentile, et le bot montre donc **deux d10**, ce qu'on lance vraiment sur une
table. Le d8 n'a pas la sienne non plus — game-icons.net refuse de la servir en
fond transparent — mais il se compose tout seul en `d6 + d2`. Le détail, la
marche à suivre et la licence sont dans `assets/emoji/LISEZ-MOI.txt`.

Le tirage utilise `crypto.randomBytes` avec rejet des valeurs biaisées, pas
`Math.random`. C'est gratuit et ça évite les discussions à la table. Bornes : 100
dés au plus, de 2 à 1000 faces.

### `/musique` — le panneau

`/musique` rejoint ton salon vocal et poste **un panneau**. Ensuite, tout se fait
aux boutons : plus rien à retaper.

```
太白金星 — Ambiances                        ┌────────┐
                                            │pochette│
▶️  Pluie sur le toit                       └────────┘
🏮 Ambiance · Chenlin · piste 2 sur 7

▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱  1:42 / 3:57

Volume               Boucle          En file
▰▰▱▱▱▱▱▱▱▱ 35 %      🔁 Liste        5

À suivre
1. Auberge au crépuscule
2. Le pont de pierre
… et 3 autres

Ambiance · Chenlin · pistes 1–25 sur 41 · page 1/2
─────────────────────────────────────────────────────
[ Où sommes-nous ?                                   ▾ ]
[ Une piste précise — page 1 sur 2                   ▾ ]
[ 🎐 Ambiance ] [ ◀ ] [ ▶ ] [ 🎶 Tout jouer ]
[ ⏸ ] [ ⏭ ] [ 🔉 ] [ 🔊 ] [ 🔁 ]
[ 🔀 Mélanger ]  [ ⏹ Arrêter et quitter ]
```

**La navigation, c'est les deux menus et les quatre boutons du haut.** Choisir un
lieu ne joue rien : ça déplace le regard. Rien de tout ça n'exige d'être en
vocal — on regarde ce qu'on a, et le bot ne vient que quand on lance une piste.

| Élément | Effet |
|---|---|
| 🎐 **Ambiance** | passe à la majeure suivante — ambiance, combat, et retour |
| Menu « Où sommes-nous ? » | change de lieu : *tous les lieux*, *Partout*, ou une région |
| ◀ / ▶ | page précédente, suivante — vingt-cinq pistes par page |
| 🎶 **Tout jouer** | joue la sélection affichée, mélangée, en boucle |
| Menu « Une piste précise » | glisse une piste devant tout le reste |
| ⏸ / ▶ | suspendre, reprendre |
| ⏭ | piste suivante |
| 🔉 / 🔊 | volume par pas de 10 % |
| 🔁 | boucle : aucune → piste → liste |
| 🔀 **Mélanger** | rebat la file d'attente |
| ⏹ **Arrêter et quitter** | silence, et le bot sort du salon |

Le pied de l'encart dit toujours où l'on en est : la majeure, le lieu, et la
tranche de pistes affichée.

Cinq rangées, c'est le plafond de Discord : **le panneau est plein**. Une
fonction de plus devra prendre la place d'une autre.

**La barre de progression avance toute seule**, toutes les dix secondes —
`PANNEAU_SECONDES` dans `.env`, `0` pour la figer. Le panneau se met aussi à jour
quand une piste s'enchaîne, quand le salon se vide et quand le bot se retire.

Quatre états, et le panneau ne dit que la vérité : **en lecture**, **en pause**,
**en veille** quand plus personne n'est là pour écouter — Discord met alors le
lecteur en sommeil tout seul — et rien en cours. La couleur de l'encart suit :
jade, or, encre.

Si la durée d'un fichier ne se lit pas, le panneau affiche le temps écoulé sans
barre plutôt que d'inventer une position.

Il faut être dans un salon vocal pour ouvrir le panneau. Relancer `/musique` dans
le même salon réutilise le panneau déjà posé au lieu d'en empiler un second. Le
bot quitte après cinq minutes de silence, et immédiatement si plus personne
n'écoute (`INACTIVITE_MINUTES` dans `.env`).

#### Illustrer les ambiances

Deux façons, toutes deux facultatives et sans rien à configurer :

- **Une pochette** : dépose un `pochette.png` (ou `.jpg`, `.webp`) dans le dossier
  d'un lieu, et il s'affiche en vignette pour toutes ses pistes. Une image portant
  le nom exact d'une piste — `pluie-sur-le-toit.jpg` à côté de
  `pluie-sur-le-toit.ogg` — l'emporte pour cette piste-là. À défaut, le bot
  remonte les dossiers : le lieu, puis la majeure, puis la racine de
  `assets/musique/`. Une image par région suffit donc.
- **Un émoji de lieu** : téléverse sur ton serveur un émoji portant le nom du
  dossier — `chenlin`, `heibing`, `combat` — et il apparaît à côté du lieu dans
  le menu et sous le titre de la piste. Même convention que les dés : la recherche
  se fait **par nom**, et l'absence ne dérange rien.

Contrairement aux fichiers audio, les images ne sont pas exclues par le
`.gitignore` : elles partent dans le dépôt et arrivent jusqu'à l'hébergeur toutes
seules.

---

## 4. Les musiques

Deux niveaux : la **majeure**, puis le **lieu**.

```
assets/musique/
    ambiance/
        tambours-lointains.ogg      ← à la racine : « Partout »
        chenlin/    bambous.ogg, pochette.png
        heibing/    neige.ogg
    combat/
        chenlin/           duel-au-sabre.ogg
        portes-de-l-enfer/ poursuite.ogg
```

Le dossier de tête est la catégorie majeure — `ambiance` ou `combat`. Le
sous-dossier est le lieu, nommé par son **slug sans accent** (`vallee-fantome`) :
le nom accentué et l'ordre des régions vivent dans
[`src/lib/lieux.js`](src/lib/lieux.js), et c'est ce nom-là qui s'affiche. Un
fichier posé directement dans une majeure vaut « Partout ». Le nom du fichier
devient le titre affiché.

Les dix-huit dossiers de lieu sont déjà là, vides. **Un lieu sans piste
n'apparaît pas dans le menu** : tu peux tous les laisser en place. Un dossier
absent de la table marche aussi — il s'affiche sous son nom, en fin de liste.

La liste complète des slugs est dans
[`assets/musique/LISEZ-MOI.txt`](assets/musique/LISEZ-MOI.txt).

Formats lus : mp3, ogg, opus, wav, flac, m4a, aac, webm. **Encode en Opus 96 kbps
mono** : Discord réencode tout en Opus 48 kHz de toute façon, et tu diviseras la
taille de ton dossier par cinq sans rien perdre à l'oreille.

```bash
ffmpeg -i source.flac -c:a libopus -b:a 96k -ac 1 assets/musique/ambiance/chenlin/sortie.ogg
```

> Les menus de Discord plafonnent à 25 entrées : c'est la taille d'une page. Au-delà,
> les boutons ◀ et ▶ font défiler, et le pied de l'encart dit où l'on en est.

---

## 5. Hébergement

### Ce que ce bot demande

Un bot Discord ne reçoit **aucune requête entrante** : il ouvre une WebSocket vers
Discord et la garde. Pas de port à exposer, pas de nom de domaine, pas de
certificat. En revanche, celui-ci a deux besoins que n'a pas un bot ordinaire :

1. **Des fichiers audio locaux**, qui doivent se trouver sur la machine.
2. **Du CPU par intermittence** : encoder un flux Opus coûte quelques pour cent
   d'un cœur, seulement pendant la lecture.

**Il ne stocke rien.** Pas de base de données, donc **aucun volume à monter** : un
redéploiement ne perd rien, sinon la musique en cours.

### Sur Railway, avec le Dockerfile fourni

Le dépôt contient déjà tout : `Dockerfile`, `railway.json`, `.dockerignore`.
Railway voit le Dockerfile et s'en sert au lieu de Nixpacks.

1. Pousse le projet sur GitHub.
2. Railway → **New Project** → **Deploy from GitHub repo**.
3. **Variables** : `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`. N'y mets pas
   `MUSIQUE_DIR` : le Dockerfile le fixe déjà.
4. Depuis ta machine, une fois : `npm run commandes` — les commandes se déclarent
   auprès de Discord, pas auprès de l'hébergeur. Inutile de le refaire à chaque
   déploiement, seulement quand tu ajoutes ou modifies une commande.

Le Dockerfile compile `@discordjs/opus` (encodeur natif, économe) et installe le
`ffmpeg` du système. `tini` transmet le `SIGTERM` que Railway envoie avant chaque
redéploiement, et le bot quitte proprement les salons vocaux au lieu d'y laisser
une connexion morte.

### Le prix, franchement

Railway n'a plus de véritable palier gratuit : le plan d'essai offre un crédit
unique d'environ 5 $, puis il faut passer au plan **Hobby**, autour de 5 $ par
mois, crédit d'usage inclus. La facturation est à l'usage, à la minute.

Pour ce bot, compte de l'ordre de **200 à 300 Mo** de mémoire au repos et un CPU
quasi nul hors lecture — soit, à vue de nez, **3 à 4 $ par mois**, donc à
l'intérieur du crédit inclus dans le plan Hobby.

> Les tarifs cités sont ceux que j'ai en tête et je n'ai pas pu les vérifier
> depuis cette machine. Regarde <https://railway.com/pricing> avant de t'engager :
> Railway a déjà changé de modèle une fois.

### Les autres pistes, si le prix compte vraiment

| Solution | Prix | Ce que ça vaut ici |
|---|---|---|
| **Railway Hobby** | ~5 $/mois | tu y es déjà, déploiement par `git push`. Le plus court chemin. |
| **VPS chez Hetzner** (CX22 ou équivalent) | ~4 €/mois | **le meilleur rapport pour ce bot précis** : tu déposes tes musiques en `scp`, 40 Go de disque, aucune limite d'usage. Il faut savoir tenir un serveur à jour. |
| **Oracle Cloud Always Free** (ARM) | 0 € | réellement gratuit et généreux. Deux réserves : la disponibilité des instances ARM est capricieuse, et Oracle supprime les comptes inactifs sans beaucoup d'égards. |
| **Un Raspberry Pi chez toi** | électricité | idéal pour des fichiers audio lourds. À la merci de ta connexion et de tes coupures de courant. |
| Fly.io, Render | variable | possible, mais leurs paliers gratuits mettent les services en veille — inacceptable pour un bot vocal. |

### Faire arriver les musiques sur le serveur

C'est le seul vrai point de friction. Le `Dockerfile` fait `COPY assets ./assets` :
il faut donc que les fichiers soient dans le dépôt git, ce que `.gitignore` empêche
aujourd'hui. Pour l'autoriser, retire les lignes `assets/musique/**/*` du
`.gitignore` — convient jusqu'à quelques centaines de mégaoctets, avec Git LFS de
préférence.

Au-delà, un VPS devient plus simple *et* moins cher, parce que tu cesses de payer
pour transporter des fichiers audio à chaque déploiement :
`scp -r assets/musique serveur:/opt/taibai/assets/`.

---

## 6. Entretien

| Situation | Quoi faire |
|---|---|
| Les commandes n'apparaissent pas | `npm run commandes`. Sans `DISCORD_GUILD_ID`, compte jusqu'à une heure. |
| Rien ne répond, rien n'apparaît | `npm run connexion` — il dit lequel des trois est en cause : le jeton, l'identifiant d'application, ou l'invitation |
| Une commande a changé de forme | rejoue `npm run commandes` : Discord ne devine rien. |
| Tout retirer | `npm run commandes:purge` |
| Le bot ne parle pas dans le salon vocal | vérifie « Se connecter » et « Parler » **sur le salon**, pas seulement sur le serveur |
| Un bouton ne répond plus | le panneau d'une session terminée est inerte : relance `/musique` |
| La barre de progression ne bouge pas | durée du fichier illisible, ou `PANNEAU_SECONDES=0`. `npm run verif` sonde une piste et le dit. |
| Vérifier la chaîne audio | `npm run verif` — liste l'encodeur Opus, le chiffrement et ffmpeg |
| Voir ce qui se passe | `LOG_LEVEL=debug` dans `.env` |

---

## 7. Ce qui n'est pas encore là

- **Reprise de la lecture après un redéploiement** : aujourd'hui, un redéploiement
  coupe la musique. Il faudrait mémoriser le salon et la piste quelque part.
- **Fondu enchaîné** entre deux ambiances. Faisable, mais il faut deux lecteurs et
  un mélange — plus de code qu'il n'y paraît.
- **Une recherche par texte** dans la bibliothèque. La navigation par lieu suffit
  tant qu'un lieu ne déborde pas ; au-delà, il faudrait une fenêtre de saisie — et
  le panneau n'a plus une rangée de libre.

---

## Structure

```
src/
    index.js              client, évènements, aiguillage des clics, arrêt propre
    config.js             lecture de .env, seul endroit qui lit process.env
    deploy-commands.js    déclaration des commandes
    invite.js             construction du lien d'invitation
    connexion.js          jeton, application, invitation : un aller-retour
    verif.js              diagnostic hors ligne
    commands/
        d.js              les dés
        r.js              le même, sous le nom habituel des joueurs
        musique.js        le panneau et ses boutons
    lib/
        des.js            analyse et lancer, tirage non biaisé
        commande-des.js   le cœur commun à /d et /r
        musique.js        bibliothèque, file d'attente, session vocale par serveur
        lieux.js          les dix-huit lieux : nom affiché, glose, ordre
        navigation.js     où en est le panneau : majeure, lieu, page
        panneau.js        le dessin du panneau : jauges, pochettes, boutons
        duree.js          durée d'un fichier audio, sondée par ffmpeg
        couleurs.js       la palette
        permissions.js    la liste qui produit le lien d'invitation
```

Ajouter une commande : un fichier dans `src/commands/` qui exporte `{ data, execute }`,
puis `npm run commandes`. Le chargeur le trouve tout seul. Pour des boutons, exporte
en plus `composant` et préfixe leurs identifiants du nom de la commande
(`macommande:action`) — `index.js` aiguille dessus tout seul.
