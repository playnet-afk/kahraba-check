# Kahraba Check

Diagnostic gratuit des factures d'électricité moyenne tension des entreprises au Maroc. Le site chiffre ce qu'un établissement paie en trop sur la puissance souscrite, l'énergie réactive et les heures de pointe, et dimensionne une installation solaire selon la loi 82-21.

Site en ligne : https://playnet-afk.github.io/kahraba-check/

## Ce que contient le site

| Page                                      | Rôle                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                                       | Présentation, exemple chiffré, questions fréquentes                                    |
| `/diagnostic/`                            | Saisie de 1 à 12 factures et calcul de la perte annuelle                               |
| `/solaire-loi-82-21/`                     | Simulateur d'autoproduction (puissance, surplus, retour, démarche)                     |
| `/guides/`                                | Guides de référencement : facture MT, puissance souscrite, énergie réactive, loi 82-21 |
| `/mentions-legales/`, `/confidentialite/` | Pages légales                                                                          |
| `/admin/`                                 | Espace administrateur : dossiers clients, démarches, documents et suivi des économies  |

Tous les calculs se font dans le navigateur. Le site n'a ni serveur, ni cookie, ni mesure d'audience.

## Démarrer

Prérequis : Node 22.22 ou plus récent (voir `.nvmrc`).

```sh
npm ci
npm run dev        # http://localhost:4321/kahraba-check/
```

| Commande         | Effet                                              |
| ---------------- | -------------------------------------------------- |
| `npm run test`   | Tests unitaires (Vitest)                           |
| `npm run check`  | Vérification des types TypeScript et Astro         |
| `npm run format` | Mise en forme du code (Prettier)                   |
| `npm run build`  | Génère le site statique dans `dist/`               |
| `npm run verify` | Tout ce qui précède, comme en intégration continue |

## Espace administrateur

`/admin/` n'est lié depuis aucune page, n'est pas indexé et n'apparaît pas dans le plan du site. Pour chaque dossier client :

1. saisie du client, de l'abonnement et des 12 factures de référence (ou reprise de la saisie du diagnostic public) ;
2. liste des démarches utiles à ce dossier, cochables, avec le gain attendu de chacune ;
3. documents générés à partir de l'analyse, prêts à imprimer ou à enregistrer en PDF : rapport, contrat de mission et mandat, lettre de modification de puissance, lettre de réclamation, demande de devis condensateurs, plan heures de pointe, état des économies ;
4. suivi des factures reçues après les démarches, économies constatées et commission restant à facturer.

Les dossiers sont enregistrés dans le stockage local du navigateur, jamais sur un serveur. La page n'a donc pas de mot de passe : une autre personne qui l'ouvre voit un outil vide. Les boutons Exporter et Importer servent de sauvegarde et de transfert entre appareils.

## Organisation du code

```
src/
  config.ts            nom du site, contacts (WhatsApp, e-mail), date de mise à jour
  lib/tarifs.ts        grille tarifaire MT et hypothèses du diagnostic
  lib/diagnostic.ts    calcul de la perte annuelle (puissance, réactive, pointe, anomalies)
  lib/solaire.ts       simulation d'autoproduction et régimes de la loi 82-21
  lib/saisie.ts        lecture des nombres tapés à la française
  lib/rapport.ts       conseils et anomalies en phrases lisibles
  lib/demarches.ts     démarches à mener selon l'analyse
  lib/documents.ts     contenu des documents de démarche
  lib/suivi.ts         économies constatées et commission
  scripts/admin.ts     comportement de l'espace administrateur
  data/exemples.ts     trois établissements fictifs pour la démonstration
  content/guides/      guides en Markdown (titre, description, dates dans l'en-tête)
  pages/               une page Astro par adresse
tests/                 tests unitaires du moteur de calcul
```

Les règles métier vivent dans `src/lib` et sont testées indépendamment de l'affichage.

## Avant la mise en service commerciale

1. **Contacts** : renseigner `whatsapp` et `email` dans `src/config.ts`. Les boutons de contact n'apparaissent qu'une fois ces champs remplis.
2. **Tarifs** : les prix de `src/lib/tarifs.ts` viennent d'une source secondaire (kherba.com, grille ONEE de juin 2026). Les confirmer sur une vraie facture et mettre à jour `SOURCE_TARIF` et `misAJourLe`.
3. **Mentions légales** : ajouter la raison sociale, le RC, l'ICE et l'adresse dès l'immatriculation.
4. **CNDP** : déclarer le traitement des factures reçues par WhatsApp ou e-mail (loi 09-08).

## Ajouter un guide

Créer `src/content/guides/mon-guide.md` :

```md
---
titre: "Titre de 70 caractères au plus"
description: "Résumé de 70 à 170 caractères, repris par les moteurs de recherche."
publieLe: 2026-11-01
ordre: 5
---

Texte du guide…
```

Le guide apparaît automatiquement dans la liste, le plan du site et les données structurées.

## Déploiement

Chaque push sur `main` lance `.github/workflows/deploiement.yml` : vérification complète, build, puis publication de `dist/` sur la branche `gh-pages`, servie par GitHub Pages. Les autres branches et les pull requests passent par `.github/workflows/ci.yml`.

Pour publier ailleurs (domaine propre, Cloudflare Pages, Netlify), définir au build :

```sh
SITE_URL=https://www.exemple.ma BASE_PATH=/ npm run build
```

`SITE_URL` sert aux adresses canoniques, au plan du site et aux images de partage ; `BASE_PATH` est le sous-dossier de publication.

Sur une adresse en sous-dossier (`utilisateur.github.io/kahraba-check/`), les moteurs ne lisent pas le `robots.txt` du sous-dossier : soumettre `sitemap-index.xml` dans Google Search Console. Avec un domaine propre et `BASE_PATH=/`, le `robots.txt` est lu normalement.
