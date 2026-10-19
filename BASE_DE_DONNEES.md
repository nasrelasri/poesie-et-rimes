# Base de données partagée (Supabase)

Sans base, un poème ajouté reste dans le navigateur où il a été ajouté.
Avec la base, les poèmes ajoutés par les enseignants apparaissent chez tout le monde.

## Mise en place (une seule fois)

1. Créer un projet gratuit sur https://supabase.com.
2. **SQL Editor → New query** : coller le contenu de `supabase.sql`, puis **Run**.
3. **Authentication → Sign In / Providers** : désactiver **Allow new users to sign up**
   (sinon n'importe qui pourrait se créer un compte enseignant).
4. **Authentication → Users → Add user → Create new user** : un compte par enseignant
   (email + mot de passe, cocher **Auto Confirm User**).
5. **Project Settings → API** : copier **Project URL** et la clé **anon public**
   dans `config.js`.

La clé `anon` peut être publique : les règles de `supabase.sql` empêchent
quiconque n'est pas connecté d'ajouter ou de supprimer.

## Utilisation

- Élèves : rien ne change, ils voient tous les poèmes.
- Enseignants : bouton **🔑 Enseignant** sur la page d'accueil, puis **＋ Ajouter un poème**
  et 🗑 pour supprimer. À la première connexion, l'application propose d'envoyer
  dans la base les poèmes ajoutés avant sur cet appareil.
