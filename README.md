# Poésie et Rimes · الشعر والقوافي

L'enfant choisit un poème (français ou arabe), le récite au micro, et l'application corrige mot par mot :

- 🟩 vert : mot juste
- 🟧 orange : presque juste (mal prononcé)
- 🟥 rouge : mot faux (on montre ce que l'enfant a dit)
- 〰️ souligné : mot oublié
- ~~barré~~ : mot en trop

## Lancer

Double-clique sur `lancer.command` : l'application s'ouvre dans Google Chrome sur http://localhost:8765.
Le micro marche dans Chrome ou Safari, et il faut une connexion internet.

## Modes

- **Tout le poème / Vers par vers** : réciter tout d'un coup, ou un vers à la fois.
- **De mémoire** : cache le texte pendant la récitation.
- **🔊 Écouter** : l'application lit le poème à voix haute.
- **✍️ Écrire au lieu de parler** : pour tester sans micro.

## Ajouter des poèmes

- Depuis l'application : bouton « ＋ Ajouter un poème ». Avec la base de données (voir `BASE_DE_DONNEES.md`),
  les enseignants connectés ajoutent des poèmes visibles par tout le monde ; sans base, ils restent dans ce navigateur.
  On peut taper le texte, ou le lire depuis une photo (📷 Photo / 🖼 Image) : choisir d'abord la langue,
  puis vérifier et corriger le texte lu avant d'enregistrer.
- Pour tout le monde : les ajouter dans `poemes.js`. Un vers par ligne, ligne vide = nouvelle strophe,
  et en arabe « / » entre الصدر et العجز.

## Fichiers

- `poemes.js` : les poèmes prédéfinis
- `moteur.js` : la comparaison entre ce que l'enfant dit et le texte
- `app.js`, `index.html`, `style.css` : l'interface
