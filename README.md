# Club 33

Un album par personne et par semaine, des notes sur 10 et un historique. À l’arrivée, chacun choisit son profil. Cédric, Côme et Issa sont présents au départ ; le bouton « Ajouter une personne » agrandit le club.

Site : https://feuille2cedric.github.io/club-33/

## Connecter la base partagée

Suivre [le guide Supabase](SUPABASE.md). Le site est sur GitHub Pages et la base sur le plan gratuit Supabase. Tant que le projet Supabase n’est pas configuré, le site affiche un message de configuration et ne permet pas d’ajouter des données.

La recherche Deezer remplit le titre, l’artiste, la pochette et le lien d’album. Le second bouton ouvre une recherche Spotify. Aucun compte développeur n’est nécessaire. La lecture complète se fait sur la plateforme choisie.

Il n’y a pas encore de mots de passe : les profils sont libres. Les clés d’administration, mots de passe et bases locales ne sont jamais publiés sur Pages.

## En local

Python 3.8 ou plus récent, sans dépendance. Double-cliquer `Lancer.bat` ou lancer `python server.py`, puis ouvrir http://localhost:3333. Sans configuration Supabase, les données sont sauvegardées dans `club33.sqlite3` sur ce PC. Le serveur local peut être partagé sur le même réseau avec `http://IP-DU-PC:3333`.

Pour transférer les données SQLite vers un projet Supabase neuf, voir la section import du guide.

## Déploiement et tests

Chaque push sur `main` ou lancement manuel de **Deploy GitHub Pages** vérifie le code et publie uniquement `static/`. Les variables `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` génèrent la configuration publique. Aucun GitHub Secret n’est envoyé au navigateur.

`python -m unittest -v` vérifie l’API locale. Le workflow vérifie aussi le JavaScript, le schéma PostgreSQL et le parcours dans Chromium.
