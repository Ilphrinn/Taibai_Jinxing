// Lecture et validation de la configuration. Rien d'autre ne lit process.env.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requis(nom) {
  const v = process.env[nom];
  if (!v || !v.trim()) {
    console.error(
      `\n  Variable d'environnement manquante : ${nom}\n` +
      `  Copie .env.exemple vers .env et remplis-la (voir README.md).\n`
    );
    process.exit(1);
  }
  return v.trim();
}

export const config = {
  jeton: requis('DISCORD_TOKEN'),
  applicationId: requis('DISCORD_APPLICATION_ID'),

  // Serveur de test : les commandes y arrivent instantanement.
  // Vide => deploiement global (jusqu'a 1 h de propagation).
  guildeId: (process.env.DISCORD_GUILD_ID || '').trim() || null,

  // Dossiers. Sur Railway, DATA_DIR pointe vers le volume monte.
  dossierDonnees: path.resolve(RACINE, process.env.DATA_DIR || './data'),
  dossierMusique: path.resolve(RACINE, process.env.MUSIQUE_DIR || './assets/musique'),

  // Reglages du lecteur audio.
  volumeDefaut: Math.min(2, Math.max(0, Number(process.env.VOLUME_DEFAUT ?? 0.35))),
  inactiviteMs: Number(process.env.INACTIVITE_MINUTES ?? 5) * 60_000,

  journalNiveau: (process.env.LOG_LEVEL || 'info').toLowerCase(),
  environnement: process.env.NODE_ENV || 'development',
};
