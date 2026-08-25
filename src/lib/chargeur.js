// Chargement des commandes : un fichier par commande dans src/commands.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE } from '../config.js';
import { log } from '../logger.js';

const DOSSIER = path.join(RACINE, 'src', 'commands');

export async function chargerCommandes() {
  const commandes = new Map();
  let fichiers;
  try {
    fichiers = (await fs.readdir(DOSSIER)).filter((f) => f.endsWith('.js'));
  } catch {
    log.warn(`Aucun dossier de commandes : ${DOSSIER}`);
    return commandes;
  }

  for (const fichier of fichiers) {
    // pathToFileURL : indispensable sous Windows, ou C:\... n est pas une URL valide.
    const module = await import(pathToFileURL(path.join(DOSSIER, fichier)).href);
    const commande = module.default ?? module;
    if (!commande?.data || typeof commande.execute !== 'function') {
      log.warn(`${fichier} ignore : il faut exporter { data, execute }.`);
      continue;
    }
    commandes.set(commande.data.name, commande);
  }

  log.ok(`${commandes.size} commandes chargees : ${[...commandes.keys()].sort().join(', ')}`);
  return commandes;
}

export async function commandesJSON() {
  const commandes = await chargerCommandes();
  return [...commandes.values()].map((c) => c.data.toJSON());
}
