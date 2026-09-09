# Brancher la base gratuite

Le site est publié sur GitHub Pages. Supabase conserve les personnes, albums et notes pour tous les appareils. Aucun serveur payant n’est nécessaire.

## 1. Créer le projet

1. Ouvrir https://supabase.com/dashboard et se connecter (avec GitHub si souhaité).
2. Créer une organisation sur le plan **Free**, puis **New project**.
3. Nommer le projet `club-33`, choisir une région européenne, et créer un mot de passe de base de données avec le générateur proposé. Conserver ce mot de passe dans son gestionnaire de mots de passe : il ne sert pas à se connecter à l’app et ne va pas dans GitHub.
4. Attendre que le projet soit prêt. Ne pas activer de plan payant.

## 2. Créer les tables

1. Dans le projet Supabase, ouvrir **SQL Editor**, puis **New query**.
2. Ouvrir [supabase/schema.sql](supabase/schema.sql), copier tout son contenu dans l’éditeur et cliquer **Run**.
3. Dans **Table Editor**, vérifier que `club_members`, `club_albums` et `club_ratings` existent. `club_members` contient Cédric, Côme et Issa.

Le script configure les droits et les fonctions de lecture et de notation. Il peut être relancé sans effacer les albums ou les notes.

## 3. Récupérer les deux valeurs publiques

Dans **Connect** ou **Settings → API Keys**, copier :

- **Project URL**, de la forme `https://xxxxxxxx.supabase.co` (également disponible dans **Settings → Data API**).
- **Publishable key**, de la forme `sb_publishable_...`. Une ancienne clé **anon** convient aussi.

Si tu copies l’URL de l’API terminée par `/rest/v1`, le déploiement la normalise automatiquement pour éviter de doubler ce chemin.

Ne pas copier la clé `sb_secret_...`, la clé `service_role`, le mot de passe de base de données ou la chaîne de connexion PostgreSQL. Le workflow refuse les clés d’administration reconnues.

## 4. Renseigner GitHub

1. Ouvrir https://github.com/Feuille2Cedric/club-33/settings/variables/actions.
2. Dans l’onglet **Variables**, cliquer **New repository variable**.
3. Ajouter `SUPABASE_URL` avec l’URL du projet.
4. Ajouter `SUPABASE_PUBLISHABLE_KEY` avec la clé publique.
5. Ouvrir **Actions → Deploy GitHub Pages → Run workflow → main → Run workflow**.
6. Attendre que le déploiement soit vert, puis actualiser https://feuille2cedric.github.io/club-33/.

Ces deux valeurs sont publiques : elles vont dans **Variables**, pas **Secrets**. Les règles SQL contrôlent les opérations autorisées. Les futurs secrets de déploiement, eux, pourront aller dans GitHub Secrets et rester uniquement côté serveur.

## 5. Vérifier à deux

1. Choisir Cédric et proposer un album en utilisant la recherche Deezer.
2. Sur un autre appareil, ouvrir le même site et choisir Côme : l’album doit apparaître.
3. Donner une note, puis vérifier sa présence sur le premier appareil après dix secondes.
4. Ajouter une personne et vérifier qu’elle apparaît sur l’écran de choix des profils.

## Mise à jour : suppression des propositions

Si les tables existaient déjà avant cette version, ouvrir **SQL Editor** et exécuter [la migration de suppression](supabase/migrations/20260909_album_delete.sql). Elle ajoute une fonction sans effacer les données existantes. Une installation neuve avec le dernier `schema.sql` inclut déjà cette fonction.

Le bouton « Retirer » apparaît sur les albums du profil sélectionné. Une confirmation affiche le titre avant suppression. La fonction vérifie que la proposition appartient au profil transmis, puis retire l’album et ses notes ensemble. Les notes des autres albums restent inchangées. Les profils restent libres tant que l’authentification n’est pas en place.

Les notes sont enregistrées séparément pour chaque couple album/personne. Changer la note de Cédric ne remplace jamais celle de Côme ou Issa. Le profil choisi est conservé dans l’onglet pour naviguer entre la sélection et `history.html` ; il peut être changé depuis l’en-tête.

## Ce qui est volontairement ouvert pour le moment

Il n’y a pas encore d’authentification, comme demandé : toute personne ayant accès au site peut choisir un profil, ajouter une personne ou un album et modifier la note de ce profil. Les suppressions directes de tables sont interdites ; seule la fonction dédiée peut retirer une proposition du profil transmis. Cette version ne protège pas les profils contre l’usurpation ; il faudra ajouter Supabase Auth avant d’exiger des mots de passe.

Les mots de passe des participants ne doivent pas être récupérés depuis GitHub Secrets par le navigateur. Supabase Auth pourra gérer leur vérification sans les publier dans le code du site.

## Recherche et écoute

La recherche utilise l’API publique Deezer directement depuis le navigateur, avec pochettes en 1000 × 1000 lorsqu’elles sont disponibles et lien direct vers l’album. Les anciennes URL Deezer de moindre résolution sont également affichées en HD, avec repli sur leur image d’origine en cas d’échec. Le bouton Spotify ouvre une recherche sur le titre et l’artiste ; il ne prétend pas être un lien exact d’album. Cela ne nécessite aucun compte développeur Spotify. Une intégration de recherche Spotify complète demanderait une application Spotify et un service côté serveur pour ses identifiants.

## Données déjà saisies en local

La base locale `club33.sqlite3` reste sur le PC et n’est jamais publiée dans le dépôt. Elle n’est pas copiée automatiquement vers Supabase. Pour générer un import compatible sans publier vos données : `python scripts/export_supabase.py`, puis exécuter le fichier local `supabase-import.sql` dans SQL Editor **juste après le schéma, avant de faire des ajouts sur le site**. Le script d’import refuse une base qui contient déjà des albums, notes ou nouveaux membres.

## Coût

Rester sur les plans gratuits GitHub et Supabase. Le plan gratuit Supabase comporte des quotas et peut mettre en pause les projets peu actifs ; si cela arrive, réactiver le projet dans le tableau de bord. Voir https://supabase.com/pricing pour les conditions en vigueur.
