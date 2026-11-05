# ⚡ FitPulse — coach fitness perso (PWA)

App web installable (iPhone + Mac) : suivi de séances, planning avec rappels Apple Calendar, vidéothèque taguée, coach basé sur des règles scientifiques, score de forme, XP, badges et graphiques. Les données sont dans Postgres → **même état sur tous tes appareils**.

## Stack

- Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind v4
- Postgres (Neon via Vercel Marketplace) · Drizzle ORM
- Recharts · lucide-react
- Auth : mot de passe commun + cookie signé HMAC (proxy Next), puis déverrouillage du profil par code PIN ou Face ID (cookie `fit_profile` signé, par appareil)

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
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (notifications push) |
   | `VAPID_SUBJECT` | `mailto:ton@email` (optionnel, défaut : URL de prod) |
   | `CRON_SECRET` | `openssl rand -hex 16` (cron quotidien des notifications) |

4. **Redéployer**. Les migrations SQL s'appliquent automatiquement au build (`scripts/migrate.mjs`).

## Installer en PWA

- **iPhone** : Safari › ouvrir l'URL › Partager › *Sur l'écran d'accueil*.
- **Mac** : Safari › Fichier › *Ajouter au Dock* (ou Chrome › Installer l'app).

Connexion valable 1 an par appareil.

## Profils

Un seul mot de passe pour l'app, **plusieurs profils** (toi, ton/ta partenaire…) : chacun a ses séances, pesées, planning, vidéos, score et coach.

- Après connexion, l'écran **« Qui s'entraîne ? »** (`/profiles`) s'affiche ; chaque profil est **verrouillé**.
- **Code PIN** (4 à 6 chiffres) choisi à la création du profil, obligatoire. **Face ID / Touch ID** en alternative une fois activé (page Profil › Verrouillage, ou page Apple).
- Un profil déverrouillé reste ouvert sur l'appareil (1 an) jusqu'à **Verrouiller maintenant** (page Profil ou sélecteur), l'ouverture d'un autre profil, ou la déconnexion. Changer : barre latérale (Mac) ou page **Profil › Changer de profil** (iPhone).
- Le cookie de profil est signé avec l'empreinte du code : impossible de le forger pour ouvrir un autre profil, et **changer son code reverrouille ses autres appareils**.
- 5 codes faux → blocage 15 min, doublé à chaque nouvel échec (24 h max) ; Face ID débloque. Le code est stocké haché (PBKDF2), jamais en clair.
- Changer de code ou supprimer le profil exige le code actuel. Supprimer un profil supprime toutes ses données, sans toucher aux autres.
- Profils créés avant le verrou : le code est demandé à leur prochaine ouverture (le premier qui l'ouvre le choisit — à faire vite).
- Code oublié : `UPDATE profile SET pin_hash = NULL WHERE name = '…';` dans la console Neon → un nouveau code sera demandé à l'ouverture.
- Les données d'avant le multi-profils sont rattachées au profil n° 1 par la migration.

## Intégrations Apple (page **Apple**)

Tout se configure depuis la page **Apple** de l'app (barre latérale, ou Profil › Apple sur iPhone), par profil.

- **Apple Santé / Apple Watch via Raccourcis** : un jeton personnel + 2 automatisations « Exercice Apple Watch » (Commence / Se termine) envoient chaque séance à `POST /api/v1/workouts` ; une automatisation quotidienne envoie la dernière pesée à `POST /api/v1/weights`. Durée, type (noms Apple FR/EN reconnus), distance, calories (sinon estimées MET × poids), RPE estimé depuis la FC. Doublons ignorés.
- **Notifications push + pastille d'icône** (iOS 16.4+, app ajoutée à l'écran d'accueil) : rappel du soir si la série est en danger ou si une séance prévue n'est pas faite, bilan du dimanche, nouveau badge. Cron Vercel `/api/cron/daily` à 17 h UTC (plan gratuit : 1 fois/jour). La pastille affiche les séances restantes de la semaine.
- **Face ID / Touch ID** : passkeys (trousseau iCloud) → connexion sans mot de passe directement sur le bon profil, et déverrouillage du profil sans taper son code.
- **Widget** écran d'accueil / verrouillé via l'app gratuite **Scriptable** (script généré avec ton jeton) : score, séances de la semaine, série, prochain créneau (`GET /api/v1/summary`).

- **Activité du jour (app Forme)** : une automatisation quotidienne envoie pas, énergie active et distance à `POST /api/v1/activity` → anneaux « Bouger » et pas sur l'accueil, et le coach calcule ta dépense avec ton niveau d'activité **mesuré** (moyenne des pas sur 14 j) au lieu de celui déclaré.

Les API `/api/v1/*` s'authentifient par `Authorization: Bearer <jeton du profil>` (régénérable / désactivable).

## Coach planificateur (page **Planning**)

Un questionnaire unique (jours dispo, heure, durée, matériel, niveau, sports aimés) et le coach génère ta semaine :

- **Composition** selon l'objectif : ≥ 2 renforcements (OMS), cardio en zone 2, 1 séance intense si le niveau le permet, sortie longue le week-end pour la performance, mobilité si beaucoup de séances.
- **Placement** : 48 h minimum entre deux séances sur les mêmes muscles (haut / bas du corps alternés), pas d'intensité la veille des jambes ; tes créneaux perso sont gardés et comptés.
- **Exercices et charges** : séries × reps et charge conseillée d'après ta meilleure charge des 6 dernières semaines ; « Faire cette séance » pré-remplit le formulaire. Les événements Calendrier listent les exercices.
- **Cycle de 4 semaines** : mise en route → progression → pic → décharge (volume −1 série, charges −15 %).
- **Adaptation automatique chaque dimanche soir** (cron) : semaine allégée si moins de la moitié des séances ont été faites ou si le ratio de charge aiguë/chronique dépasse 1,3 (avec ≥ 3 semaines d'historique) ; notification « programme prêt ».

## Rappels de séances (Calendrier Apple)

Page **Planning** › *S'abonner* (lien `webcal://`, **propre à chaque profil** — le profil n° 1 garde l'ancien lien, les abonnements existants continuent de marcher) :

- **Mac** : Calendrier › Fichier › Nouvel abonnement › emplacement **iCloud** (→ synchro iPhone/Watch) › **décocher « Supprimer : Alertes »** › actualisation toutes les heures.
- 2 alertes par séance : X min avant + à l'heure.
- Alternative : *Importer (.ics)* = événements fixes dans ton calendrier iCloud (alertes garanties, pas de mise à jour auto).

## Fonctionnalités

- **Séances** : 13 types (force / cardio / mobilité), durée, RPE, distance, exercices séries × reps × kg, notes, vidéo liée.
- **Variation** : 29 programmes prêts (salle, maison avec haltères, sans matériel, cardio, mobilité), bouton « Surprends-moi », séance suggérée selon ta semaine (≥ 2 séances de force OMS, récup après grosse charge, alternance des stimuli).
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
- Tudor-Locke & Bassett, *Sports Med* 2004 — niveaux d'activité selon les pas/jour
- Paluch et al., *Lancet Public Health* 2022 — pas/jour et mortalité

## Dev local

```bash
cp .env.example .env.local   # renseigner DATABASE_URL (Postgres local ou Neon)
npm install
DATABASE_URL=... npm run db:migrate
npm run dev
```

Modifier le schéma : `src/lib/schema.ts` puis `npm run db:generate`.
