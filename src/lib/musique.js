// Lecteur audio : bibliotheque de fichiers locaux, file d'attente, une session par serveur.
import fs from 'node:fs';
import path from 'node:path';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, entersState,
  AudioPlayerStatus, VoiceConnectionStatus, NoSubscriberBehavior, StreamType,
  getVoiceConnection,
} from '@discordjs/voice';
import ffmpeg from 'ffmpeg-static';
import { config } from '../config.js';
import { duree } from './duree.js';
import { niveau, prevoir, gainConnu } from './niveau.js';
import { comparerLieu, comparerMajeure, lieuConnu, nomLieu, SANS_LIEU } from './lieux.js';
import { log } from '../logger.js';

// prism-media cherche ffmpeg dans FFMPEG_PATH en priorite.
if (ffmpeg && !process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = ffmpeg;

const EXTENSIONS = new Set(['.mp3', '.ogg', '.opus', '.wav', '.flac', '.m4a', '.aac', '.webm']);
export const MODES_BOUCLE = ['aucune', 'piste', 'liste'];

// Un pas de fondu toutes les 40 ms : assez fin pour que l oreille n entende
// pas les marches, assez gros pour ne rien couter.
const PAS_FONDU = 40;

// Quand la correction de niveau arrive apres le debut de la piste, on rejoint
// le nouveau gain par une glissade plutot que par un saut audible.
const GLISSADE_GAIN_MS = 1000;

/**
 * Interpole d une valeur a une autre en appelant `poser` a chaque pas.
 * Rend de quoi attendre la fin ET de quoi l interrompre : un fondu en cours
 * doit ceder la place au suivant sans se battre avec lui.
 *
 * Exportee pour que `npm run verif` puisse verifier la rampe hors ligne : sans
 * connexion, c est le seul moyen de voir qu un fondu arrive bien a destination.
 */
export function rampe(depuis, vers, ms, poser) {
  if (ms <= 0 || depuis === vers) {
    poser(vers);
    return { promesse: Promise.resolve(), annuler() {} };
  }
  let fini;
  const promesse = new Promise((r) => { fini = r; });
  const debut = Date.now();
  const minuterie = setInterval(() => {
    const part = Math.min(1, (Date.now() - debut) / ms);
    poser(depuis + (vers - depuis) * part);
    if (part >= 1) { clearInterval(minuterie); fini(); }
  }, PAS_FONDU);
  minuterie.unref?.();
  return {
    promesse,
    annuler() { clearInterval(minuterie); fini(); },
  };
}

// --- Bibliotheque --------------------------------------------------------

let cache = { pistes: [], date: 0 };
const DUREE_CACHE = 30_000;

function parcourir(dossier, sortie) {
  let entrees;
  try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); }
  catch { return; }
  for (const e of entrees) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) {
      parcourir(complet, sortie);
    } else if (EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
      const id = path.relative(config.dossierMusique, complet).replace(/\\/g, '/');
      const segments = id.split('/');

      // Deux paliers, et le rangement se lit dans le chemin plutot que de
      // s heriter du dossier de tete : le premier segment est la majeure
      // (ambiance, combat), le deuxieme le lieu. Une piste posee a la racine
      // d une majeure n a pas de lieu — elle vaut « Partout ». Plus profond,
      // elle reste rattachee a son lieu : il n y a pas de troisieme palier.
      const majeure = segments.length > 1 ? segments[0] : 'divers';
      const lieu = segments.length > 2 ? segments[1] : null;

      sortie.push({
        titre: path.basename(e.name, path.extname(e.name)).replace(/[_-]+/g, ' ').trim(),
        fichier: e.name,
        majeure,
        lieu,
        // Ancien nom du dossier de tete. Garde parce que la recherche d emoji
        // et l affichage s en servent encore.
        categorie: majeure,
        chemin: complet,
        id,
      });
    }
  }
}

export function bibliotheque({ forcer = false } = {}) {
  if (!forcer && Date.now() - cache.date < DUREE_CACHE) return cache.pistes;
  const pistes = [];
  parcourir(config.dossierMusique, pistes);
  pistes.sort((a, b) =>
    comparerMajeure(a.majeure, b.majeure)
    || comparerLieu(a.lieu, b.lieu)
    || a.titre.localeCompare(b.titre));
  cache = { pistes, date: Date.now() };
  return pistes;
}

/** Les dossiers de tete qui contiennent vraiment quelque chose. */
export function majeures() {
  return [...new Set(bibliotheque().map((p) => p.majeure))].sort(comparerMajeure);
}

/**
 * Les lieux peuples d une majeure, dans l ordre de la table, precedes du bac
 * « Partout » s il n est pas vide. Un lieu sans piste n apparait pas : les
 * dossiers vides de l arborescence n encombrent donc pas le menu.
 */
export function lieux(majeure) {
  const compte = new Map();
  for (const p of bibliotheque()) {
    if (p.majeure !== majeure) continue;
    compte.set(p.lieu, (compte.get(p.lieu) ?? 0) + 1);
  }
  return [...compte.keys()].sort(comparerLieu).map((slug) => {
    const connu = lieuConnu(slug);
    return {
      slug,
      nom: nomLieu(slug),
      glose: slug ? connu?.glose ?? null : SANS_LIEU.glose,
      propose: Boolean(connu?.propose),
      nombre: compte.get(slug),
    };
  });
}

// --- Sessions ------------------------------------------------------------

const sessions = new Map();

class Session {
  constructor(guilde, salonVocal, salonTexte) {
    this.guildeId = guilde.id;
    this.salonVocalId = salonVocal.id;
    this.salonTexte = salonTexte;
    this.file = [];
    this.courante = null;
    this.volume = config.volumeDefaut;
    this.boucle = 'aucune';
    this.minuterie = null;
    this.ressource = null;

    // De quoi ecrire « piste 2 sur 7 » : la file est consommee par shift(),
    // donc son seul comptage ne dit pas ou l on en est.
    this.rang = 0;
    this.total = 0;

    // Le volume reellement envoye est le produit de trois choses : le reglage
    // demande (`volume`), la correction de niveau de la piste (`gain`, mesuree
    // par lib/niveau.js) et l etat du fondu (`attenuation`, de 0 a 1). Seul
    // `volume` est montre dans le panneau : c est le reglage, pas la correction.
    this.gain = 1;
    this.attenuation = 1;
    this.fondu = null;      // rampe d attenuation en cours
    this.glissade = null;   // rampe de gain en cours
    this.finProche = null;  // minuterie du fondu de sortie

    // Le panneau de /musique s accroche ici : la session previent quand son
    // etat change de lui-meme (fin de piste, retrait pour inactivite), sinon
    // l affichage mentirait jusqu au prochain clic. Le panneau lui-meme ne vit
    // PAS ici — il doit survivre a la session (voir commands/musique.js).
    this.surChangement = null;

    this.connexion = joinVoiceChannel({
      channelId: salonVocal.id,
      guildId: guilde.id,
      adapterCreator: guilde.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.lecteur = createAudioPlayer({
      behaviors: { noSubscriberBehavior: NoSubscriberBehavior.Pause, maxMissedFrames: 50 },
    });
    this.connexion.subscribe(this.lecteur);

    this.lecteur.on(AudioPlayerStatus.Idle, () => this.#surFin());

    // Le panneau doit suivre les changements d etat qui ne viennent pas d un
    // clic : mise en veille quand le salon se vide, reprise quand quelqu un
    // revient. On ne previent que pour la pause et la veille — le demarrage
    // d une piste est deja annonce par #jouerSuivante(), et la fin par #surFin().
    const VEILLE = new Set([AudioPlayerStatus.Paused, AudioPlayerStatus.AutoPaused]);
    this.lecteur.on('stateChange', (avant, apres) => {
      if (avant.status === apres.status) return;
      if (VEILLE.has(apres.status) || VEILLE.has(avant.status)) this.surChangement?.();
    });

    this.lecteur.on('error', (err) => {
      log.error(`Lecture de ${this.courante?.titre} :`, err.message);
      this.salonTexte?.send(`⚠️ Lecture interrompue : ${this.courante?.titre ?? 'piste inconnue'}`)
        .catch(() => {});
      this.#surFin();
    });

    // Reprise automatique apres une coupure reseau ou un deplacement de salon.
    this.connexion.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connexion, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connexion, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.detruire();
      }
    });
  }

  async pret() {
    await entersState(this.connexion, VoiceConnectionStatus.Ready, 20_000);
    return this;
  }

  ajouter(pistes) {
    this.file.push(...pistes);
    this.total += pistes.length;
    return this.file.length;
  }

  /** Glisse une piste devant tout le reste. */
  prioriser(piste) {
    this.file.unshift(piste);
    this.total += 1;
    return this.file.length;
  }

  async demarrer() {
    if (this.courante || !this.file.length) return null;
    return this.#jouerSuivante();
  }

  async #jouerSuivante() {
    this.#annulerMinuterie();
    this.#annulerFondu();
    this.#annulerFinProche();
    const piste = this.file.shift();
    if (!piste) {
      this.courante = null;
      this.#armerMinuterie();
      this.surChangement?.();
      return null;
    }
    this.courante = piste;
    // En boucle sur la liste, les pistes reviennent : le rang repart a 1.
    this.rang = this.total && this.rang >= this.total ? 1 : this.rang + 1;

    this.ressource = createAudioResource(piste.chemin, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
      metadata: piste,
    });

    // Le gain deja mesure s applique tout de suite ; sinon on part a 1 et on y
    // glissera quand la mesure arrivera.
    this.gain = gainConnu(piste.chemin);
    this.attenuation = config.fonduMs > 0 ? 0 : 1;
    this.#appliquerVolume();
    this.lecteur.play(this.ressource);
    log.info(`[${this.guildeId}] lecture : ${piste.id}`);

    // Fondu d entree : on monte du silence au volume voulu.
    this.#fondre(1, config.fonduMs);

    // La duree se sonde en tache de fond : la lecture n a pas a attendre
    // ffmpeg, et une duree inconnue n empeche rien. Le panneau se redessine
    // quand elle arrive, pour faire apparaitre la barre de progression — et
    // c est aussi elle qui permet d armer le fondu de sortie.
    if (piste.duree) {
      this.#armerFinProche();
    } else {
      duree(piste.chemin).then((ms) => {
        if (!ms) return;
        piste.duree = ms;
        if (this.courante !== piste) return;
        this.#armerFinProche();
        this.surChangement?.();
      }).catch(() => { /* une duree inconnue n est pas une erreur */ });
    }

    // La mesure de niveau decode le fichier entier : on ne l attend pas. Si
    // elle arrive en cours de lecture, on rejoint le gain par une glissade.
    niveau(piste.chemin).then((mesure) => {
      if (!mesure || this.courante !== piste) return;
      this.#glisserGain(mesure.gain);
    }).catch(() => { /* un niveau inconnu n est pas une erreur */ });

    // Et on prend de l avance sur la suivante : le temps qu elle arrive, son
    // gain sera connu et rien ne bougera en cours de lecture.
    prevoir(this.file[0]?.chemin);

    this.surChangement?.();
    return piste;
  }

  // --- Volume, fondu ------------------------------------------------------

  #appliquerVolume() {
    this.ressource?.volume?.setVolume(this.volume * this.gain * this.attenuation);
  }

  #annulerFondu() {
    this.fondu?.annuler();
    this.fondu = null;
  }

  /** Amene l attenuation a `vers` (0 = silence, 1 = plein). */
  #fondre(vers, ms = config.fonduMs) {
    this.#annulerFondu();
    this.fondu = rampe(this.attenuation, vers, ms, (v) => {
      this.attenuation = v;
      this.#appliquerVolume();
    });
    return this.fondu.promesse;
  }

  /** Rejoint un gain fraichement mesure sans saut audible. */
  #glisserGain(vers) {
    this.glissade?.annuler();
    this.glissade = rampe(this.gain, vers, GLISSADE_GAIN_MS, (v) => {
      this.gain = v;
      this.#appliquerVolume();
    });
  }

  #annulerFinProche() {
    if (this.finProche) { clearTimeout(this.finProche); this.finProche = null; }
  }

  /**
   * Arme le fondu de sortie d une piste qui va se terminer d elle-meme.
   * Une pause decale la fin reelle : plutot qu une deuxieme minuterie pour la
   * suivre, on se recale au moment de fondre — `position` ne ment pas.
   */
  #armerFinProche() {
    this.#annulerFinProche();
    if (config.fonduMs <= 0 || !this.courante?.duree) return;
    const reste = this.courante.duree - this.position - config.fonduMs;
    this.finProche = setTimeout(() => {
      this.finProche = null;
      const encore = (this.courante?.duree ?? 0) - this.position - config.fonduMs;
      if (encore > 250) { this.#armerFinProche(); return; }
      this.#fondre(0);
    }, Math.max(0, reste));
    this.finProche.unref?.();
  }

  /** Descend au silence avant une coupure voulue. */
  async #fondreSortie() {
    this.#annulerFinProche();
    if (config.fonduMs <= 0 || !this.courante) return;
    await this.#fondre(0);
  }

  async #surFin() {
    if (this.boucle === 'piste' && this.courante) {
      this.file.unshift(this.courante);
    } else if (this.boucle === 'liste' && this.courante) {
      this.file.push(this.courante);
    }
    const precedente = this.courante;
    this.courante = null;
    const suivante = await this.#jouerSuivante();
    if (!suivante && precedente) {
      this.salonTexte?.send('🎐 La file est vide, le silence revient.').catch(() => {});
    }
  }

  async suivant() {
    await this.#fondreSortie();
    const ancienne = this.boucle;
    if (ancienne === 'piste') this.boucle = 'aucune'; // passer outre la boucle sur une piste
    this.lecteur.stop(true);
    this.boucle = ancienne;
  }

  pause() { return this.lecteur.pause(true); }
  reprendre() { return this.lecteur.unpause(); }

  definirVolume(v) {
    this.volume = Math.min(2, Math.max(0, v));
    // Le fondu et la correction de niveau restent ou ils en sont : un reglage
    // en cours de fondu ne doit ni l annuler ni etre ecrase par lui.
    this.#appliquerVolume();
    return this.volume;
  }

  melanger() {
    for (let i = this.file.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.file[i], this.file[j]] = [this.file[j], this.file[i]];
    }
    return this.file.length;
  }

  vider() {
    const n = this.file.length;
    this.file = [];
    this.rang = 0;
    this.total = 0;
    return n;
  }

  async stop() {
    await this.#fondreSortie();
    this.vider();
    this.boucle = 'aucune';
    this.courante = null;
    this.lecteur.stop(true);
    this.#armerMinuterie();
  }

  get statut() { return this.lecteur.state.status; }

  /** Millisecondes de son deja jouees : n avance pas pendant une pause. */
  get position() { return this.ressource?.playbackDuration ?? 0; }

  #armerMinuterie() {
    this.#annulerMinuterie();
    if (config.inactiviteMs <= 0) return;
    this.minuterie = setTimeout(() => {
      log.info(`[${this.guildeId}] deconnexion pour inactivite`);
      this.salonTexte?.send('🌙 Le silence dure : je me retire.').catch(() => {});
      this.detruire();
    }, config.inactiviteMs);
    this.minuterie.unref?.();
  }

  #annulerMinuterie() {
    if (this.minuterie) { clearTimeout(this.minuterie); this.minuterie = null; }
  }

  detruire() {
    this.#annulerMinuterie();
    this.#annulerFinProche();
    this.#annulerFondu();
    this.glissade?.annuler();
    this.glissade = null;
    try { this.lecteur.stop(true); } catch { /* ignore */ }
    try { this.connexion.destroy(); } catch { /* deja detruite */ }
    this.courante = null;
    sessions.delete(this.guildeId);
    // Prevenir en dernier : le panneau doit voir une session deja retiree.
    this.surChangement?.();
  }
}

export function session(guildeId) {
  return sessions.get(guildeId) ?? null;
}

/** Rejoint le salon vocal du membre (ou reutilise la session existante). */
export async function rejoindre(membre, salonTexte) {
  const salonVocal = membre.voice?.channel;
  if (!salonVocal) throw new Error('Rejoins un salon vocal avant de me le demander.');

  const perms = salonVocal.permissionsFor(membre.guild.members.me);
  if (!perms?.has('Connect') || !perms?.has('Speak')) {
    throw new Error(`Il me manque « Se connecter » ou « Parler » dans ${salonVocal}.`);
  }

  let s = sessions.get(membre.guild.id);
  if (s && s.salonVocalId !== salonVocal.id) { s.detruire(); s = null; }
  if (!s) {
    s = new Session(membre.guild, salonVocal, salonTexte);
    sessions.set(membre.guild.id, s);
    try { await s.pret(); }
    catch (err) { s.detruire(); throw new Error(`Connexion vocale impossible : ${err.message}`); }
  }
  if (salonTexte) s.salonTexte = salonTexte;
  return s;
}

/** Quitte tous les salons (arret propre du processus). */
export function toutQuitter() {
  for (const s of [...sessions.values()]) s.detruire();
}

/** Se retire si le salon vocal ne contient plus que le bot. */
export function surChangementVocal(ancien, nouveau) {
  const guildeId = ancien.guild?.id ?? nouveau.guild?.id;
  const s = sessions.get(guildeId);
  if (!s) return;
  const salon = ancien.guild.channels.cache.get(s.salonVocalId);
  if (!salon) return;
  const humains = salon.members.filter((m) => !m.user.bot).size;
  if (humains === 0) {
    log.info(`[${guildeId}] salon vocal vide, retrait`);
    s.detruire();
  }
}

export function connexionExistante(guildeId) { return getVoiceConnection(guildeId); }
