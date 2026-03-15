import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const data = {
  phases: [
    { id: 'prod',     name: '1 — Production',                  period: 'mars → mai',        milestones: 'Mix 18/04, Masters singles 09/05, Master album 23/05' },
    { id: 'visual',   name: '2 — Identité visuelle',           period: 'mars → juillet',    milestones: 'Artwork 30/05, Clip 18/07' },
    { id: 'distrib',  name: '3 — Distribution & Plateformes',  period: 'mai → août',        milestones: 'Distrib mai, Single soumis 04/07, Album soumis 15/08' },
    { id: 'singles',  name: '4 — Singles',                      period: 'août → septembre',  milestones: 'Single 1 + clip 01/08, Single 2 05/09' },
    { id: 'press',    name: '5 — Presse & Promo',              period: 'juillet → octobre',  milestones: 'EPK juillet, Promos 01/08' },
    { id: 'physical', name: '6 — Physique',                     period: 'juin → septembre',  milestones: 'Vinyle commandé juin, CDs août' },
    { id: 'booking',  name: '7 — Booking & Tournée',           period: 'mai → hiver',       milestones: 'Booking juin-juil, Release show ~26/09' },
    { id: 'summer',   name: '8 — Été = Préparation',           period: 'mai → août',        milestones: 'Clip, merch, mailing list, rodage live' },
    { id: 'release',  name: '9 — Sortie & Post-sortie',        period: '26 sept →',         milestones: '🎯 SORTIE 26 SEPTEMBRE' },
  ],

  tasks: [
    // Phase 1 : Production
    { id: 'p1-1', phase: 'prod', text: 'Finaliser le mix',                      deadlineDate: '2026-04-18', notes: 'Confortable. Priorité haute mais pas de panique.', done: false },
    { id: 'p1-2', phase: 'prod', text: 'Choisir un ingé mastering',             deadlineDate: '2026-04-04', notes: 'Comparer, devis, écouter des références.', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p1-3', phase: 'prod', text: 'Master des singles (×2 ou 3)',          deadlineDate: '2026-05-09', notes: '', done: false },
    { id: 'p1-4', phase: 'prod', text: "Master de l'album complet",             deadlineDate: '2026-05-23', notes: '', done: false },
    { id: 'p1-5', phase: 'prod', text: 'Valider les masters',                   deadlineDate: '2026-05-30', notes: '', done: false },
    { id: 'p1-6', phase: 'prod', text: 'Master spécifique vinyle (optionnel)',   deadlineDate: '2026-06-13', notes: "Améliore significativement le rendu. À voir avec l'ingé.", done: false },

    // Phase 2 : Identité visuelle
    { id: 'p2-1', phase: 'visual', text: "Finaliser l'artwork album",           deadlineDate: '2026-05-30', notes: '', done: false },
    { id: 'p2-2', phase: 'visual', text: "Décliner l'artwork pour les singles", deadlineDate: '2026-06-06', notes: '', done: false },
    { id: 'p2-3', phase: 'visual', text: 'Shooting photos promo',               deadlineDate: '2026-05-15', notes: 'Trouver le bon photographe.', done: false },
    { id: 'p2-4', phase: 'visual', text: 'Retouche / sélection photos',         deadlineDate: '2026-06-30', notes: '', done: false },
    { id: 'p2-5', phase: 'visual', text: 'Visuels réseaux sociaux (templates)',  deadlineDate: '2026-07-31', notes: '', done: false },
    { id: 'p2-6', phase: 'visual', text: 'Clip vidéo (single 1)',               deadlineDate: '2026-07-18', notes: 'Tournage mai-juin, montage juin-juillet.', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p2-7', phase: 'visual', text: 'Lyric video ou visualizer (single 2)',deadlineDate: '2026-08-31', notes: 'Deuxième contenu vidéo, moins ambitieux.', done: false },

    // Phase 3 : Distribution & Plateformes
    { id: 'p3-1', phase: 'distrib', text: 'Choisir un distributeur digital',    deadlineDate: '2026-05-31', notes: '', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p3-2', phase: 'distrib', text: 'Créer/réclamer Spotify for Artists', deadlineDate: '2026-05-31', notes: '', done: false },
    { id: 'p3-3', phase: 'distrib', text: 'Soumettre le single 1',              deadlineDate: '2026-07-04', notes: '~4 semaines avant sortie single.', done: false },
    { id: 'p3-4', phase: 'distrib', text: 'Pitch Spotify editorial (single 1)', deadlineDate: '2026-07-04', notes: '', done: false },
    { id: 'p3-5', phase: 'distrib', text: "Soumettre l'album complet",          deadlineDate: '2026-08-15', notes: '~6 semaines avant sortie.', done: false },
    { id: 'p3-6', phase: 'distrib', text: 'Soumettre le single 2',              deadlineDate: '2026-08-22', notes: '', done: false },
    { id: 'p3-7', phase: 'distrib', text: 'Éventuel single 3 / soumettre',      deadlineDate: '2026-09-05', notes: 'Optionnel.', done: false },

    // Phase 4 : Singles
    { id: 'p4-1', phase: 'singles', text: 'Choisir les singles (2 ou 3)',        deadlineDate: '2026-05-31', notes: 'Tester les réactions en live.', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p4-2', phase: 'singles', text: 'Sortie Single 1 + clip',             deadlineDate: '2026-08-01', notes: "~8 semaines avant l'album. Le clip donne un vrai lancement.", done: false },
    { id: 'p4-3', phase: 'singles', text: 'Promo single 1',                     deadlineDate: '2026-08-15', notes: '', done: false },
    { id: 'p4-4', phase: 'singles', text: 'Sortie Single 2',                    deadlineDate: '2026-09-05', notes: "~3 semaines avant l'album.", done: false },
    { id: 'p4-5', phase: 'singles', text: 'Promo single 2',                     deadlineDate: '2026-09-10', notes: '', done: false },
    { id: 'p4-6', phase: 'singles', text: 'Éventuel single 3 / focus track',    deadlineDate: '2026-09-19', notes: 'Optionnel. Dernière salve.', done: false },
    { id: 'p4-7', phase: 'singles', text: 'Pré-save / pré-commande',            deadlineDate: '2026-09-05', notes: 'Activés au single 2.', done: false },

    // Phase 5 : Presse & Promo
    { id: 'p5-1', phase: 'press', text: "Constituer l'EPK",                     deadlineDate: '2026-07-31', notes: 'Bio, photos, artwork, liens privés, rider, dates.', done: false },
    { id: 'p5-2', phase: 'press', text: 'Lister les médias cibles',             deadlineDate: '2026-07-31', notes: 'Webzines, blogs, radios asso, podcasts metal.', done: false },
    { id: 'p5-3', phase: 'press', text: 'Envoi promos presse',                  deadlineDate: '2026-08-01', notes: '8 semaines avant sortie = timing idéal.', done: false },
    { id: 'p5-4', phase: 'press', text: 'Relances presse',                      deadlineDate: '2026-09-01', notes: '', done: false },
    { id: 'p5-5', phase: 'press', text: 'Interviews / chroniques',              deadlineDate: '2026-10-15', notes: '', done: false },
    { id: 'p5-6', phase: 'press', text: 'Candidatures festivals 2027',          deadlineDate: '2026-12-31', notes: 'Avec album sorti + chroniques + dates jouées.', done: false },
    { id: 'p5-7', phase: 'press', text: 'Attaché de presse : on en prend un ? Lequel ?', deadlineDate: '2026-06-15', notes: 'Couvre ou non la phase 5 (presse & promo).', done: false, decision: { status: 'open', notes: '' } },

    // Phase 6 : Physique
    { id: 'p6-1', phase: 'physical', text: 'Choisir presseur CD',                deadlineDate: '2026-06-30', notes: '', done: false },
    { id: 'p6-2', phase: 'physical', text: 'Préparer fichiers impression CD',    deadlineDate: '2026-07-31', notes: '', done: false },
    { id: 'p6-3', phase: 'physical', text: 'Commander pressage CD',              deadlineDate: '2026-07-31', notes: 'Prêt bien avant la sortie.', done: false },
    { id: 'p6-4', phase: 'physical', text: 'Réception CDs',                      deadlineDate: '2026-08-31', notes: '', done: false },
    { id: 'p6-5', phase: 'physical', text: 'Pressage vinyle (100 ex.)',          deadlineDate: '2026-06-30', notes: 'Délai ~12-16 sem. 100vinyl.com ou Vinyl de Paris. Budget à évaluer — commande en juin.', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p6-6', phase: 'physical', text: 'Préparer fichiers vinyle (artwork gatefold, etc.)',deadlineDate: '2026-06-30', notes: 'Gabarits vinyle ≠ CD.', done: false },
    { id: 'p6-7', phase: 'physical', text: 'Réception vinyles',                  deadlineDate: '2026-09-15', notes: '', done: false },
    { id: 'p6-8', phase: 'physical', text: 'Bandcamp : boutique physique en ligne',deadlineDate: '2026-08-31', notes: 'CD + vinyle en précommande.', done: false },

    // Phase 7 : Booking & Tournée
    { id: 'p7-1',  phase: 'booking', text: 'Rédiger fiche technique + rider',    deadlineDate: '2026-06-15', notes: 'Backline, son/lumière, durée set, plan de scène.', done: false },
    { id: 'p7-2',  phase: 'booking', text: 'Campagne de booking',                deadlineDate: '2026-07-31', notes: "Les bookers peuvent écouter l'album entier.", done: false },
    { id: 'p7-3',  phase: 'booking', text: 'Chercher des groupes pour co-tourner',deadlineDate: '2026-07-31', notes: 'Split dates ou mini-tournée à plusieurs.', done: false },
    { id: 'p7-4',  phase: 'booking', text: 'Définir le routing (régions prioritaires)',deadlineDate: '2026-07-31', notes: 'Axes géo réalistes. Voir strategie_booking.md.', done: false },
    { id: 'p7-5',  phase: 'booking', text: 'Budget tournée',                     deadlineDate: '2026-08-15', notes: 'Estimation par date. Objectif = équilibre ou léger bénéfice.', done: false },
    { id: 'p7-6',  phase: 'booking', text: "Confirmer les dates d'automne",      deadlineDate: '2026-08-31', notes: 'Objectif : 6-10 dates sept-déc.', done: false },
    { id: 'p7-7',  phase: 'booking', text: 'Release show Paris',                 deadlineDate: '2026-09-26', notes: 'Septembre = reprise saison, salles dispo.', done: false, decision: { status: 'open', notes: '' } },
    { id: 'p7-8',  phase: 'booking', text: "Tournée d'automne",                  deadlineDate: '2026-11-15', notes: '4-6 dates FR/BE sur 1-2 weekends ou 1 semaine.', done: false },
    { id: 'p7-9',  phase: 'booking', text: 'Dates ponctuelles hiver',            deadlineDate: '2027-02-28', notes: 'Dates opportunistes, soirées locales, premières parties.', done: false },
    { id: 'p7-10', phase: 'booking', text: 'Candidatures festivals été 2027',    deadlineDate: '2026-12-31', notes: 'Album sorti + chroniques + dates jouées = dossier solide.', done: false },
    { id: 'p7-11', phase: 'booking', text: 'Bilan tournée + ajustements',        deadlineDate: '2027-01-31', notes: '', done: false },

    // Phase 8 : Été = Préparation
    { id: 'p8-1', phase: 'summer', text: 'Tourner le clip',                      deadlineDate: '2026-06-30', notes: 'Réalisateur, repérage, tournage, montage.', done: false },
    { id: 'p8-2', phase: 'summer', text: 'Peaufiner stratégie réseaux sociaux',  deadlineDate: '2026-07-31', notes: 'Calendrier de contenu.', done: false },
    { id: 'p8-3', phase: 'summer', text: 'Préparer le merch',                    deadlineDate: '2026-08-31', notes: "T-shirts, patches, posters — prêts avant tournée automne.", done: false },
    { id: 'p8-4', phase: 'summer', text: 'Tester morceaux en live',              deadlineDate: '2026-08-31', notes: "Roder le set avant la tournée d'automne.", done: false },
    { id: 'p8-5', phase: 'summer', text: 'Monter une mailing list',              deadlineDate: '2026-09-01', notes: 'Bandcamp, concerts, réseaux.', done: false },

    // Phase 9 : Sortie & Post-sortie
    { id: 'p9-1', phase: 'release', text: '🎯 SORTIE ALBUM',                    deadlineDate: '2026-09-26', notes: '', isReleaseDate: true, done: false },
    { id: 'p9-2', phase: 'release', text: 'Posts réseaux sociaux jour J',        deadlineDate: '2026-09-26', notes: '', done: false },
    { id: 'p9-3', phase: 'release', text: 'Newsletter',                          deadlineDate: '2026-09-26', notes: '', done: false },
    { id: 'p9-4', phase: 'release', text: 'Release show',                        deadlineDate: '2026-09-26', notes: '', done: false },
    { id: 'p9-5', phase: 'release', text: "Tournée d'automne",                   deadlineDate: '2026-11-15', notes: '', done: false },
    { id: 'p9-6', phase: 'release', text: 'Suivi presse',                        deadlineDate: '2026-10-31', notes: '', done: false },
    { id: 'p9-7', phase: 'release', text: 'Candidatures festivals 2027',         deadlineDate: '2027-01-31', notes: '', done: false },
    { id: 'p9-8', phase: 'release', text: 'Bilan + suite',                       deadlineDate: '2026-12-31', notes: '', done: false },
  ],

  decisionLog: [
    { date: '13 mars 2026', text: 'Création du retroplanning. Deux scénarios étudiés (29 mai vs 26 sept).' },
    { date: '13 mars 2026', text: 'Scénario retenu : sortie le 26 septembre 2026.' },
  ],
};

await writeFile(join(__dirname, 'data.json'), JSON.stringify(data, null, 2));
console.log('data.json seeded with CoD retroplanning data.');
