# Récupérer les notes qui sont sur Discord

Le but : obtenir un fichier **JSON** de tes salons Discord, que je puisse lire comme je lis
déjà les PowerPoint et le Word. L'outil s'appelle **DiscordChatExporter**, il est gratuit et
libre.

Si tu n'as que quelques messages à récupérer, saute tout ça : copie-les dans un `.txt`,
mets-le dans `Sources/RP Chine/`, et c'est réglé. Ce qui suit vaut pour un historique entier.

---

## 1. Télécharger l'outil

<https://github.com/Tyrrrz/DiscordChatExporter/releases> — prends la dernière version.

Deux paquets, même programme :

| Paquet | Pour qui |
|---|---|
| `DiscordChatExporter.zip` | version fenêtrée, tu cliques |
| `DiscordChatExporter.CLI.zip` | version en ligne de commande |

**Prends la version fenêtrée** si tu ne tiens pas à la ligne de commande : elle fait
exactement la même chose, et il n'y a que trois champs à remplir. Je donne les deux plus bas.

Dézippe où tu veux. Il faut le **.NET Runtime** ; si Windows réclame quelque chose au
lancement, il te donnera le lien.

---

## 2. Obtenir un jeton

C'est la seule étape qui demande de l'attention. Deux voies.

### Voie A — un bot (recommandée)

C'est la voie propre : Discord l'autorise explicitement, et le jeton ne donne accès qu'à ce
que tu laisses voir au bot.

1. Va sur <https://discord.com/developers/applications> et clique **New Application**.
   Donne-lui un nom quelconque (« Archiviste »).
2. Onglet **Bot** → **Reset Token** → **Copy**. C'est ton jeton. **Ne le partage avec
   personne**, moi compris : je n'en ai pas besoin, je ne veux que le fichier exporté.
3. Toujours dans l'onglet **Bot**, descends jusqu'à **Privileged Gateway Intents** et active
   **Message Content Intent**. Sans lui, l'export ramène des messages vides.
4. Onglet **OAuth2 → URL Generator** :
   - Scopes : coche **bot**
   - Bot Permissions : coche **View Channels** et **Read Message History**
   - Copie l'URL générée en bas, ouvre-la, choisis ton serveur, autorise.
5. Sur Discord, vérifie que le bot voit bien les salons voulus. S'ils sont privés, il faut
   l'ajouter explicitement au salon (clic droit sur le salon → Modifier le salon →
   Permissions → ajouter le bot).

Il faut être administrateur du serveur pour l'étape 4. Si le serveur n'est pas le tien,
demande à celui qui l'administre.

### Voie B — ton propre jeton de compte

Plus rapide, mais **Discord l'interdit dans ses conditions d'utilisation** (c'est considéré
comme un « self-bot »). À toi de voir. La marche à suivre est dans l'outil lui-même :

```
DiscordChatExporter.Cli.exe guide
```

---

## 3. Trouver les identifiants

Dans Discord : **Paramètres → Avancés → Mode développeur** (à activer). Ensuite, clic droit
sur un salon ou sur le serveur → **Copier l'identifiant**.

Ou bien demande-les à l'outil :

```
DiscordChatExporter.Cli.exe guilds   -t "TON_JETON"
DiscordChatExporter.Cli.exe channels -t "TON_JETON" -g IDENTIFIANT_DU_SERVEUR
```

---

## 4. Exporter

### Version fenêtrée

1. Lance `DiscordChatExporter.exe`, colle le jeton, clique la flèche.
2. Sélectionne le ou les salons dans la colonne de gauche (Ctrl+clic pour plusieurs).
3. Clique l'icône d'export en haut à droite.
4. **Format : `JSON`** — c'est le seul point à ne pas rater. Le HTML est joli mais pénible à
   relire pour un programme ; le JSON garde les auteurs, les dates, les réponses et les
   pièces jointes.
5. Choisis le dossier de sortie et lance.

### Version en ligne de commande

Un salon :

```
DiscordChatExporter.Cli.exe export -t "TON_JETON" -c IDENTIFIANT_DU_SALON -f Json -o "salon.json"
```

Tout le serveur, fils de discussion compris — c'est ce que je prendrais :

```
DiscordChatExporter.Cli.exe exportguild -t "TON_JETON" -g IDENTIFIANT_DU_SERVEUR ^
    -f Json --include-threads all -o "discord/"
```

Le `-o` qui finit par une barre oblique est un **dossier** : l'outil y écrit un fichier par
salon, nommé d'après lui. C'est très bien pour moi.

Quelques options utiles :

| Option | Effet |
|---|---|
| `--after "2024-01-01"` | seulement à partir d'une date |
| `--before "2025-06-30"` | seulement jusqu'à une date |
| `--media` | télécharge aussi les images et fichiers joints |
| `--reuse-media` | ne retélécharge pas ce qui est déjà là |
| `--include-threads all` | inclut les fils, y compris archivés |
| `-p 20mb` | découpe en fichiers de 20 Mo |

**N'utilise pas `-p`** sauf si un fichier devient vraiment énorme : un seul fichier par salon
est plus simple à traiter. Et laisse `--media` de côté pour un premier essai — c'est ce qui
prend du temps et de la place.

---

## 5. Ce que tu me donnes

Dépose le ou les `.json` dans :

```
Sources/RP Chine/Discord/
```

Dis-moi ensuite **quels salons contiennent du lore** (comptes rendus de séance, descriptions,
échanges en jeu) et lesquels sont de l'organisation pure. J'écrirai `tools/lire-discord.js`
sur le modèle de ce qui lit déjà les PowerPoint : découpage ligne à ligne, rattachement des
mentions aux fiches existantes, extraits reportés des deux côtés quand deux personnages sont
cités ensemble — exactement le traitement que reçoivent aujourd'hui les notes de campagne.

Le JSON de DiscordChatExporter contient l'auteur, l'horodatage et le fil de réponse : je peux
donc dater les évènements et attribuer les notes à leur auteur, ce que les fiches PowerPoint
ne permettent pas.

---

## Ce qui coince le plus souvent

- **Messages vides à l'export** → le *Message Content Intent* n'est pas activé (étape 2.3).
- **« Channel not found » ou salon absent de la liste** → le bot n'a pas accès à ce salon.
  C'est une permission de salon, pas de serveur.
- **Export très lent** → normal, Discord limite le débit ; l'outil attend tout seul. Un
  serveur de plusieurs années peut demander une heure.
- **Le fichier fait des centaines de Mo** → c'est `--media` qui télécharge les images.
  Sans lui, du texte pur, quelques Mo au plus.

---

## Une précaution

Le jeton, bot ou compte, donne accès à des conversations. Ne le mets pas dans un fichier du
projet, ne me l'envoie pas, ne le colle pas dans un message. Je n'ai besoin que du résultat
de l'export.

Sources : [documentation du CLI](https://github.com/Tyrrrz/DiscordChatExporter/blob/prime/.docs/Using-the-CLI.md) ·
[dépôt du projet](https://github.com/Tyrrrz/DiscordChatExporter)
