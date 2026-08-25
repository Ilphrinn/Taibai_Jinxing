# 太白金星 — Tàibái Jīnxīng

Bot Discord pour la table de jeu de rôle en Chine mythologique : dés, fiches de
personnage, oracle du *Yì Jīng*, voix des PNJ, et diffusion des musiques d'ambiance
depuis des fichiers rangés sur le serveur.

Tout est en place et vérifié hors ligne. Il te manque trois choses : une application
Discord, un jeton, et tes fichiers audio.

---

## 1. Mise en route

### Créer l'application

1. <https://discord.com/developers/applications> → **New Application**. Nomme-la
   « Taibai Jinxing ».
2. Onglet **Bot** → **Reset Token** → **Copy**. C'est le jeton. Il ne s'affiche
   qu'une fois ; si tu le perds, tu le réinitialises.
3. Onglet **General Information** → copie l'**Application ID**.

**Aucun intent privilégié à activer.** Le bot ne lit pas les messages : il ne
fonctionne qu'aux commandes `/`. C'est délibéré — moins de permissions, moins de
surface, et Discord n'a rien à vérifier si un jour tu dépasses cent serveurs.

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
npm run commandes         # déclare les commandes auprès de Discord
npm start
```

---

## 2. Le lien d'invitation

Remplace `TON_APPLICATION_ID` par ton Application ID :

```
https://discord.com/api/oauth2/authorize?client_id=TON_APPLICATION_ID&permissions=396134575424&scope=bot%20applications.commands
```

`npm run lien` produit exactement ce lien, avec ton identifiant, plus une variante
minimale. Le nombre `396134575424` n'est pas saisi à la main : il est calculé par
discord.js à partir de [`src/lib/permissions.js`](src/lib/permissions.js). Si tu
retires une permission de cette liste, le lien se recalcule tout seul.

| Permission | Pourquoi |
|---|---|
| Voir les salons, Envoyer des messages, Écrire dans les fils | toute réponse |
| Intégrer des liens, Joindre des fichiers | fiches, oracle, scènes |
| Lire l'historique, Ajouter des réactions, Émojis externes | confort |
| **Se connecter, Parler, Détection de la voix** | **diffuser la musique** |
| Voix prioritaire | baisser la musique quand le MJ parle |
| **Gérer les webhooks** | **faire parler les PNJ sous leur nom et leur portrait** |
| Gérer les messages | épingler une scène, effacer une erreur |
| Créer et gérer les fils | un fil par scène, apartés MJ ↔ joueur |
| Déplacer les membres, Rendre muet | réunir la table, silence rituel |
| Gérer les pseudos, Gérer les rôles | renommer un joueur, attribuer une secte |

Les quatre dernières lignes sont du confort de maître du jeu. Si tu préfères un bot
discret, prends le **lien minimal** que `npm run lien` affiche en second : dés,
oracle et musique, rien d'autre. Tu pourras toujours élargir plus tard en réouvrant
le lien complet — Discord met à jour les permissions sans réinstaller le bot.

> Ni `Administrator`, ni `Mentionner @everyone` : le bot n'en a pas besoin, et un
> jeton qui fuite fait alors beaucoup moins de dégâts.

---

## 3. Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `/jet des 2d6+3` | notation libre ; `4d6kh3` garde les trois plus hauts, `3d10kl1` le plus bas |
| `/jet action mouvement:eau difficulte:15` | d20 + le mouvement de ta fiche, avec avantage et verdict |
| `/perso creer\|voir\|modifier\|souffle\|liste` | fiche bâtie sur les cinq mouvements (五行) |
| `/oracle consulter` | tirage aux trois pièces, traits mutants et hexagramme d'arrivée |
| `/oracle hexagramme numero:23` | lire une figure précise |
| `/pnj nature:immortel` | une figure complète tirée au sort : nom chinois, rôle, trait, secret |
| `/voix dire qui:… message:…` | le PNJ parle sous son nom et son portrait (webhook) |
| `/scene texte:… ambiance:tendu` | cartouche de narration, épinglable |
| `/musique jouer\|ambiance\|volume\|pause\|stop` | diffusion des fichiers locaux |
| `/aide` | le tout, dans Discord |

Quelques partis pris, que tu peux changer :

- **Les cinq mouvements** (bois, feu, terre, métal, eau) servent d'attributs, avec
  les cycles d'engendrement et de domination. La fiche affiche le palier de
  cultivation et une réserve de *souffle*.
- **Les dés** utilisent `crypto.randomBytes` avec rejet des valeurs biaisées, pas
  `Math.random`. C'est gratuit et ça évite les discussions à la table.
- **L'oracle** applique la vraie méthode des trois pièces (6/7/8/9) et la table du
  Roi Wen — vérifiée comme bijection sur les 64 hexagrammes. Les traits mutants
  donnent l'hexagramme d'arrivée, comme il se doit.

---

## 4. Les musiques

Range tes fichiers en sous-dossiers, un par ambiance :

```
assets/musique/
    ambiance/   auberge.mp3, pluie-sur-le-toit.mp3
    combat/     duel-au-sabre.mp3
    rituel/     temple.mp3
```

Le dossier devient la catégorie, le nom du fichier devient le titre affiché.
`/musique ambiance categorie:combat` enchaîne tout le dossier, mélangé, en boucle.
`/musique jouer` propose une autocomplétion qui filtre à la frappe.

Formats lus : mp3, ogg, opus, wav, flac, m4a, aac, webm. **Encode en Opus 96 kbps
mono** : Discord réencode tout en Opus 48 kHz de toute façon, et tu diviseras la
taille de ton dossier par cinq sans rien perdre à l'oreille.

```bash
ffmpeg -i source.flac -c:a libopus -b:a 96k -ac 1 assets/musique/ambiance/sortie.ogg
```

Le bot quitte le salon vocal après cinq minutes de silence, et immédiatement si
plus personne n'écoute (`INACTIVITE_MINUTES` dans `.env`).

---

## 5. Hébergement

### Ce que ce bot demande

Un bot Discord ne reçoit **aucune requête entrante** : il ouvre une WebSocket vers
Discord et la garde. Pas de port à exposer, pas de nom de domaine, pas de
certificat. En revanche, celui-ci a deux besoins que n'a pas un bot ordinaire :

1. **Des fichiers audio locaux**, qui doivent se trouver sur la machine.
2. **Du CPU par intermittence** : encoder un flux Opus coûte quelques pour cent
   d'un cœur, seulement pendant la lecture. C'est peu, mais ce n'est pas nul.

La base SQLite (fiches, PNJ, journal des jets) tient dans quelques mégaoctets et
doit survivre aux redéploiements — d'où le volume, plus bas.

### Sur Railway, avec le Dockerfile fourni

Le dépôt contient déjà tout : `Dockerfile`, `railway.json`, `.dockerignore`.
Railway voit le Dockerfile et s'en sert au lieu de Nixpacks.

1. Pousse le projet sur GitHub.
2. Railway → **New Project** → **Deploy from GitHub repo**.
3. **Variables** : `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID`. N'y mets pas
   `DATA_DIR` ni `MUSIQUE_DIR` : le Dockerfile les fixe déjà.
4. **Volume** : Settings → Volumes → **New Volume**, point de montage `/data`.
   Sans lui, les fiches disparaissent au premier redéploiement.
5. Depuis ta machine, une fois : `npm run commandes` — les commandes se déclarent
   auprès de Discord, pas auprès de l'hébergeur. Inutile de le refaire à chaque
   déploiement, seulement quand tu ajoutes ou modifies une commande.

Le Dockerfile compile `@discordjs/opus` (encodeur natif, économe) et installe le
`ffmpeg` du système. `tini` transmet le `SIGTERM` que Railway envoie avant chaque
redéploiement, et le bot quitte proprement les salons vocaux au lieu d'y laisser
une connexion morte.

### Le prix, franchement

Railway n'a plus de véritable palier gratuit : le plan d'essai offre un crédit
unique d'environ 5 $, puis il faut passer au plan **Hobby**, autour de 5 $ par
mois, crédit d'usage inclus. La facturation est à l'usage : mémoire et CPU
consommés, à la minute.

Pour ce bot, compte de l'ordre de **200 à 300 Mo** de mémoire au repos et un CPU
quasi nul hors lecture — soit, à vue de nez, **3 à 4 $ par mois**, donc à
l'intérieur du crédit inclus dans le plan Hobby. Ton autre bot consomme en plus.

> Les tarifs cités sont ceux que j'ai en tête et je n'ai pas pu les vérifier
> depuis cette machine. Regarde <https://railway.com/pricing> avant de t'engager :
> Railway a déjà changé de modèle une fois.

### Les autres pistes, si le prix compte vraiment

| Solution | Prix | Ce que ça vaut ici |
|---|---|---|
| **Railway Hobby** | ~5 $/mois | tu y es déjà, déploiement par `git push`, volume simple. Le plus court chemin. |
| **VPS chez Hetzner** (CX22 ou équivalent) | ~4 €/mois | **le meilleur rapport pour ce bot précis** : tu déposes tes musiques en `scp`, 40 Go de disque, aucune limite d'usage. Il faut savoir tenir un serveur à jour. |
| **Oracle Cloud Always Free** (ARM) | 0 € | réellement gratuit et généreux (ARM, plusieurs Go de RAM). Deux réserves : la disponibilité des instances ARM est capricieuse, et Oracle supprime les comptes inactifs sans beaucoup d'égards. |
| **Un Raspberry Pi chez toi** | électricité | idéal pour des fichiers audio lourds. À la merci de ta connexion et de tes coupures de courant. |
| Fly.io, Render | variable | possible, mais leurs paliers gratuits mettent les services en veille — inacceptable pour un bot vocal. |

Mon conseil : **reste sur Railway** tant que ton dossier de musiques tient dans
l'image (disons moins de 500 Mo). Au-delà, un VPS à 4 € devient plus simple *et*
moins cher, parce que tu cesses de payer pour transporter des fichiers audio à
chaque déploiement.

### Faire arriver les musiques sur le serveur

C'est le seul vrai point de friction. Trois façons, par ordre de simplicité :

**a. Dans l'image Docker** (ce que fait le `Dockerfile` : `COPY assets ./assets`).
Il faut alors que les fichiers soient dans le dépôt git. Simple, mais `.gitignore`
les exclut aujourd'hui, et git supporte mal les gros binaires. Convient jusqu'à
quelques centaines de mégaoctets, avec Git LFS de préférence. Pour l'activer,
retire la ligne `assets/musique/**` de `.gitignore`.

**b. Sur le volume Railway.** Monte le volume sur `/data`, mets
`MUSIQUE_DIR=/data/musique` dans les variables, et pousse les fichiers avec la CLI
Railway. Les musiques cessent d'alourdir chaque déploiement.

**c. Depuis un stockage objet** (Cloudflare R2, Backblaze B2 — quelques centimes
par mois) : une synchronisation au démarrage vers le volume. C'est la solution
propre si la bibliothèque grossit, mais c'est du travail en plus. On la garde pour
le jour où elle sera nécessaire.

Sur un VPS, la question ne se pose pas : `scp -r assets/musique serveur:/opt/taibai/assets/`.

---

## 6. Entretien

| Situation | Quoi faire |
|---|---|
| Les commandes n'apparaissent pas | `npm run commandes`. Sans `DISCORD_GUILD_ID`, compte jusqu'à une heure. |
| Une commande a changé de forme | rejoue `npm run commandes` : Discord ne devine rien. |
| Tout retirer | `npm run commandes:purge` |
| Le bot ne parle pas dans le salon vocal | vérifie « Se connecter » et « Parler » **sur le salon**, pas seulement sur le serveur |
| « Il me manque Gérer les webhooks » | permission de salon, à donner sur le salon concerné |
| Vérifier la chaîne audio | `npm run verif` — liste l'encodeur Opus, le chiffrement et ffmpeg |
| Voir ce qui se passe | `LOG_LEVEL=debug` dans `.env` |

---

## 7. Ce qui n'est pas encore là

Rien de tout cela ne manque pour jouer, mais l'ossature est prête à les recevoir :

- **Reprise de la lecture après un redéploiement** : aujourd'hui, un redéploiement
  coupe la musique. On pourrait mémoriser le salon et la piste dans la base.
- **Import de tes exports Discord** : `DISCORD.md` décrit la récupération de
  l'historique. Une commande `/note` qui verse dans la même base ferait le lien
  entre le bot et tes fiches existantes.
- **Fondu enchaîné** entre deux ambiances. Faisable, mais il faut deux lecteurs et
  un mélange — plus de code qu'il n'y paraît.
- **Initiative et combat** : rien n'est fait, faute de connaître ton système.

---

## Structure

```
src/
    index.js              client, évènements, arrêt propre
    config.js             lecture de .env, seul endroit qui lit process.env
    deploy-commands.js    déclaration des commandes
    invite.js             construction du lien d'invitation
    verif.js              diagnostic hors ligne
    commands/             une commande par fichier, chargées automatiquement
    lib/
        des.js            analyse et lancer, tirage non biaisé
        musique.js        bibliothèque, file d'attente, session vocale par serveur
        db.js             SQLite via node:sqlite — aucune dépendance à compiler
        permissions.js    la liste qui produit le lien d'invitation
    data/
        hexagrammes.js    les 64 figures, la table du Roi Wen
        noms.js           noms, rôles, traits et secrets
```

Ajouter une commande : un fichier dans `src/commands/` qui exporte `{ data, execute }`,
puis `npm run commandes`. Le chargeur le trouve tout seul.
