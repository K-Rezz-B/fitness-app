# ⚡ FitPulse — coach fitness perso (PWA)

App web installable (iPhone + Mac) : suivi de séances, planning avec rappels Apple Calendar, vidéothèque taguée, coach basé sur des règles scientifiques, score de forme, XP, badges et graphiques. Les données sont dans Postgres → **même état sur tous tes appareils**.

## Stack

- Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind v4
- Postgres (Neon via Vercel Marketplace) · Drizzle ORM
- Recharts · lucide-react
- Auth mono-utilisateur : mot de passe + cookie signé HMAC (proxy Next)

## Déploiement Vercel (≈ 5 min)

1. **Importer le repo** sur [vercel.com/new](https://vercel.com/new).
2. **Base de données** : projet Vercel › *Storage* › *Create* › **Neon** (Postgres, free tier) › connecter au projet. `DATABASE_URL` est injectée automatiquement.
3. **Variables d'environnement** (*Settings › Environment Variables*) :

   | Variable | Valeur |
   |---|---|
   | `APP_PASSWORD` | ton mot de passe |
   | `AUTH_SECRET` | `openssl rand -hex 32` |
   | `CALENDAR_TOKEN` | `openssl rand -hex 16` |
   | `APP_TIMEZONE` | `Europe/Paris` (optionnel) |

4. **Redéployer**. Les migrations SQL s'appliquent automatiquement au build (`scripts/migrate.mjs`).

## Installer en PWA

- **iPhone** : Safari › ouvrir l'URL › Partager › *Sur l'écran d'accueil*.
- **Mac** : Safari › Fichier › *Ajouter au Dock* (ou Chrome › Installer l'app).

Connexion valable 1 an par appareil.

## Rappels de séances (Calendrier Apple)

Page **Planning** › *S'abonner* (lien `webcal://`) :

- **Mac** : Calendrier › Fichier › Nouvel abonnement › emplacement **iCloud** (→ synchro iPhone/Watch) › **décocher « Supprimer : Alertes »** › actualisation toutes les heures.
- 2 alertes par séance : X min avant + à l'heure.
- Alternative : *Importer (.ics)* = événements fixes dans ton calendrier iCloud (alertes garanties, pas de mise à jour auto).

## Fonctionnalités

- **Séances** : 12 types (force / cardio / mobilité), durée, RPE, distance, exercices séries × reps × kg, notes, vidéo liée.
- **Variation** : 18 programmes prêts, bouton « Surprends-moi », séance suggérée selon ta semaine (≥ 2 séances de force OMS, récup après grosse charge, alternance des stimuli).
- **Score de forme /100** : régularité 40 · volume OMS 25 · série 20 · variété 15.
- **Motivation** : XP & niveaux, séries jours/semaines, 10 badges, heatmap 18 semaines, minutes/semaine par catégorie, citation du jour.
- **Coach** : IMC, métabolisme (Mifflin-St Jeor), dépense totale, calories & macros selon objectif, hydratation, tendance de poids (moyenne 7 j), alerte charge (ACWR), conseils sourcés.
- **Vidéos** : liens YouTube / Instagram / TikTok / Vimeo, tags, favoris, recherche, lecture YouTube intégrée.

## Sources des règles du coach

- Mifflin et al., *Am J Clin Nutr* 1990 — métabolisme de base
- OMS, *Guidelines on physical activity* 2020 — 150-300 min/sem, ≥ 2 j de renforcement
- ISSN Position Stand: Protein & Exercise, 2017 — 1,4-2,0 g/kg/j
- Helms et al., *JISSN* 2014 — perte 0,5-1 %/sem
- Gabbett, *Br J Sports Med* 2016 — ratio charge aiguë/chronique
- Foster et al., *J Strength Cond Res* 2001 — charge sRPE
- Ainsworth et al., Compendium of Physical Activities 2011 — MET

## Dev local

```bash
cp .env.example .env.local   # renseigner DATABASE_URL (Postgres local ou Neon)
npm install
DATABASE_URL=... npm run db:migrate
npm run dev
```

Modifier le schéma : `src/lib/schema.ts` puis `npm run db:generate`.
