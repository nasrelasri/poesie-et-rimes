#!/bin/bash
# Double-clique sur ce fichier pour lancer l'application dans Google Chrome.
cd "$(dirname "$0")"
PORT=8765
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVEUR=$!
trap 'kill $SERVEUR' EXIT
sleep 1
open -a "Google Chrome" "http://localhost:$PORT" || open "http://localhost:$PORT"
echo "Poésie et Rimes tourne sur http://localhost:$PORT"
echo "Ferme cette fenêtre pour arrêter l'application."
wait $SERVEUR
