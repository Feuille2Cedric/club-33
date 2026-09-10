# Club 33

Club 33 est une application de partage d'albums entre amis. Chaque semaine, chaque membre propose un album à écouter. Tout le monde voit les propositions de la semaine, peut écouter sur Deezer ou Spotify, mettre sa propre note sur 10, écrire une review, puis retrouver les anciennes semaines dans l'historique.

## App en ligne

**https://feuille2cedric.github.io/club-33/**

## Concept

Le fonctionnement est volontairement simple :

1. En arrivant sur l'app, on choisit son profil.
2. Chaque personne peut proposer un album par semaine.
3. Les albums de la semaine s'affichent pour tout le monde.
4. Chacun met sa note indépendamment des autres.
5. Chacun peut ajouter une review texte avec sa note.
6. Les anciennes semaines restent consultables dans l'historique.
7. Le classement montre qui propose les albums les mieux notés.

Les profils de départ sont :

- Cédric
- Côme
- Issa

De nouvelles personnes peuvent être ajoutées directement depuis l'interface.

## Fonctionnalités

- Choix du profil à l'ouverture.
- Ajout de membres depuis l'app.
- Une proposition d'album par personne et par semaine.
- Recherche d'album via Deezer.
- Pochette HD quand elle est disponible.
- Lien Deezer direct vers l'album.
- Lien Spotify ou recherche Spotify automatique.
- Notes indépendantes par utilisateur.
- Reviews indépendantes par utilisateur.
- Moyenne globale par album.
- Suppression de sa propre proposition.
- Historique propre des semaines passées.
- Classement des membres selon la moyenne reçue sur leurs albums proposés.
- Déploiement gratuit avec GitHub Pages.
- Base partagée gratuite avec Supabase.
- Mode local possible avec SQLite.

## Notes et reviews

Chaque note est enregistrée par couple `album + membre`.

Cela veut dire que la note de Cédric ne remplace jamais celle de Côme ou Issa. La review suit la même règle : chaque personne a son propre texte pour chaque album.

Dans l'interface, il est possible de :

- écrire une review avant de cliquer sur une note ;
- cliquer sur une note pour sauvegarder la note et la review ;
- modifier la review plus tard avec le bouton `Enregistrer review`.

## Classement

Le classement répond à une question simple : qui propose les meilleurs albums ?

Il calcule, pour chaque membre :

- le nombre d'albums proposés ;
- le nombre de notes reçues ;
- la moyenne des notes reçues sur ses propositions.

## Base de données

En ligne, l'app utilise Supabase. En local, elle peut utiliser SQLite automatiquement.

Pour connecter Supabase, suivre le guide complet :

[SUPABASE.md](SUPABASE.md)

Si la base Supabase existe déjà, appliquer les migrations dans cet ordre :

1. [20260909_album_delete.sql](supabase/migrations/20260909_album_delete.sql)
2. [20260910_leaderboard.sql](supabase/migrations/20260910_leaderboard.sql)
3. [20260910_rating_reviews.sql](supabase/migrations/20260910_rating_reviews.sql)

Si aucune donnée importante n'existe encore dans Supabase, le plus simple est d'exécuter d'abord :

[schema.sql](supabase/schema.sql)

Puis les migrations ci-dessus si nécessaire.

## Lancement local

Prérequis : Python 3.8 ou plus récent.

Depuis PowerShell :

```powershell
cd C:\Users\crima\OneDrive\Bureau\DEV\club-33
python server.py
```

Puis ouvrir :

```text
http://localhost:3333
```

En local, les données sont stockées dans :

```text
club33.sqlite3
```

Cette base locale n'est pas publiée sur GitHub.

## Déploiement

Le site est publié avec GitHub Pages depuis le repo :

**https://github.com/Feuille2Cedric/club-33**

Chaque push sur `main` déclenche le workflow de déploiement.

Le workflow publie uniquement le dossier `static/`.

## Configuration GitHub Pages + Supabase

Les deux valeurs publiques Supabase sont injectées pendant le déploiement :

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Ces valeurs vont dans les variables GitHub Actions, pas dans les secrets, car elles sont publiques côté navigateur.

Ne jamais mettre dans le front :

- clé `service_role` ;
- clé `sb_secret_...` ;
- mot de passe PostgreSQL ;
- chaîne de connexion complète.

## Sécurité actuelle

Il n'y a pas encore de mots de passe. Les profils sont donc libres : une personne ayant accès au lien peut choisir n'importe quel profil.

Les opérations sensibles sont limitées côté SQL autant que possible :

- les suppressions passent par une fonction dédiée ;
- une personne ne peut supprimer que la proposition du profil sélectionné ;
- les clés d'administration ne sont pas publiées ;
- la base SQLite locale reste hors du déploiement.

Pour verrouiller réellement les profils plus tard, il faudra ajouter Supabase Auth.

## Tests

Tests locaux :

```powershell
python -m unittest -v
```

Le workflow GitHub vérifie aussi :

- le JavaScript ;
- le schéma PostgreSQL ;
- le parcours navigateur avec Chromium.

## Structure

```text
club-33/
├── static/                  # app publiée sur GitHub Pages
│   ├── index.html
│   ├── history.html
│   ├── app.js
│   ├── data.js
│   ├── style.css
│   └── favicon.svg
├── supabase/
│   ├── schema.sql
│   └── migrations/
├── scripts/                 # scripts de config/export/tests
├── server.py                # serveur local SQLite
├── club33.sqlite3           # base locale ignorée par Git
├── README.md
└── SUPABASE.md
```

## Statut

Club 33 est fonctionnel avec :

- partage hebdomadaire d'albums ;
- membres extensibles ;
- notes ;
- reviews ;
- historique ;
- classement ;
- suppression des propositions ;
- déploiement GitHub Pages ;
- stockage Supabase.
