// Base SQLite via le module natif de Node (node:sqlite) : aucune dependance a compiler.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { log } from '../logger.js';

fs.mkdirSync(config.dossierDonnees, { recursive: true });
const fichier = path.join(config.dossierDonnees, 'taibai.db');

export const db = new DatabaseSync(fichier);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS personnages (
    guilde_id     TEXT NOT NULL,
    joueur_id     TEXT NOT NULL,
    nom           TEXT NOT NULL,
    titre         TEXT,
    voie          TEXT NOT NULL DEFAULT 'terre',
    palier        INTEGER NOT NULL DEFAULT 1,
    souffle       INTEGER NOT NULL DEFAULT 10,
    souffle_max   INTEGER NOT NULL DEFAULT 10,
    bois          INTEGER NOT NULL DEFAULT 2,
    feu           INTEGER NOT NULL DEFAULT 2,
    terre         INTEGER NOT NULL DEFAULT 2,
    metal         INTEGER NOT NULL DEFAULT 2,
    eau           INTEGER NOT NULL DEFAULT 2,
    karma         INTEGER NOT NULL DEFAULT 0,
    notes         TEXT,
    avatar        TEXT,
    cree_le       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guilde_id, joueur_id)
  );

  CREATE TABLE IF NOT EXISTS pnj (
    guilde_id  TEXT NOT NULL,
    cle        TEXT NOT NULL,
    nom        TEXT NOT NULL,
    avatar     TEXT,
    cree_par   TEXT NOT NULL,
    cree_le    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guilde_id, cle)
  );

  CREATE TABLE IF NOT EXISTS jets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guilde_id  TEXT NOT NULL,
    joueur_id  TEXT NOT NULL,
    expression TEXT NOT NULL,
    total      INTEGER NOT NULL,
    detail     TEXT NOT NULL,
    date       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_jets_guilde ON jets (guilde_id, date DESC);
`);

log.ok(`Base ouverte : ${fichier}`);

// --- Personnages ---------------------------------------------------------

const q = {
  perso: db.prepare('SELECT * FROM personnages WHERE guilde_id = ? AND joueur_id = ?'),
  persoListe: db.prepare('SELECT * FROM personnages WHERE guilde_id = ? ORDER BY nom'),
  persoSuppr: db.prepare('DELETE FROM personnages WHERE guilde_id = ? AND joueur_id = ?'),
  pnj: db.prepare('SELECT * FROM pnj WHERE guilde_id = ? AND cle = ?'),
  pnjListe: db.prepare('SELECT * FROM pnj WHERE guilde_id = ? ORDER BY nom'),
  pnjSuppr: db.prepare('DELETE FROM pnj WHERE guilde_id = ? AND cle = ?'),
  jetAjout: db.prepare(
    'INSERT INTO jets (guilde_id, joueur_id, expression, total, detail) VALUES (?, ?, ?, ?, ?)'
  ),
};

export const personnages = {
  lire: (guilde, joueur) => q.perso.get(guilde, joueur) ?? null,
  liste: (guilde) => q.persoListe.all(guilde),
  supprimer: (guilde, joueur) => q.persoSuppr.run(guilde, joueur).changes > 0,

  creer(guilde, joueur, champs) {
    db.prepare(`
      INSERT INTO personnages (guilde_id, joueur_id, nom, titre, voie, bois, feu, terre, metal, eau, notes, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (guilde_id, joueur_id) DO UPDATE SET
        nom = excluded.nom, titre = excluded.titre, voie = excluded.voie,
        bois = excluded.bois, feu = excluded.feu, terre = excluded.terre,
        metal = excluded.metal, eau = excluded.eau,
        notes = excluded.notes, avatar = excluded.avatar
    `).run(
      guilde, joueur, champs.nom, champs.titre ?? null, champs.voie,
      champs.bois, champs.feu, champs.terre, champs.metal, champs.eau,
      champs.notes ?? null, champs.avatar ?? null
    );
    return this.lire(guilde, joueur);
  },

  // Mise a jour partielle : seules les colonnes autorisees sont acceptees.
  modifier(guilde, joueur, champs) {
    const permis = ['nom', 'titre', 'voie', 'palier', 'souffle', 'souffle_max',
      'bois', 'feu', 'terre', 'metal', 'eau', 'karma', 'notes', 'avatar'];
    const cles = Object.keys(champs).filter((c) => permis.includes(c) && champs[c] !== undefined);
    if (!cles.length) return this.lire(guilde, joueur);
    const set = cles.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE personnages SET ${set} WHERE guilde_id = ? AND joueur_id = ?`)
      .run(...cles.map((c) => champs[c]), guilde, joueur);
    return this.lire(guilde, joueur);
  },
};

export const pnjs = {
  lire: (guilde, cle) => q.pnj.get(guilde, cle) ?? null,
  liste: (guilde) => q.pnjListe.all(guilde),
  supprimer: (guilde, cle) => q.pnjSuppr.run(guilde, cle).changes > 0,
  enregistrer(guilde, cle, nom, avatar, auteur) {
    db.prepare(`
      INSERT INTO pnj (guilde_id, cle, nom, avatar, cree_par) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (guilde_id, cle) DO UPDATE SET nom = excluded.nom, avatar = excluded.avatar
    `).run(guilde, cle, nom, avatar ?? null, auteur);
    return this.lire(guilde, cle);
  },
};

export const journalJets = {
  ajouter: (guilde, joueur, expression, total, detail) =>
    q.jetAjout.run(guilde, joueur, expression, total, detail),
};

export function fermerBase() {
  try { db.close(); } catch { /* deja fermee */ }
}
