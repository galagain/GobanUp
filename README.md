# GobanUp

Club de go en français avec comptes par pseudo, demandes d’amitié, défis privés, salons par lien et recherche d’adversaire. Les comptes et les parties en ligne sont enregistrés dans SQLite. Le bot, les études SGF et l’analyse KataGo fonctionnent dans le navigateur.

## Serveur galagain.com

Le site est accessible sur https://gobanup.galagain.com. Depuis le répertoire du projet, `docker compose up -d --build` construit l’application et démarre le tunnel Cloudflare. Le fichier privé `deploy/tunnel-credentials.json` correspond au tunnel déclaré dans `deploy/tunnel.yml` et se provisionne sur le serveur. Le port local est `127.0.0.1:8093`. La base se trouve dans le volume Docker `gobanup_goban-data`, au chemin `/data/gobanup.sqlite` du conteneur web.

Les migrations SQL du dossier `drizzle` s’appliquent au démarrage. Le serveur utilise Node 24, les sessions utilisent des cookies HTTPS et les mots de passe sont hachés avec PBKDF2-SHA256 et un sel individuel.

## Jouer

Dans **Amis**, créez un compte, puis envoyez une demande au pseudo de votre partenaire. Une fois la demande acceptée, **Inviter à jouer** permet de choisir un goban de 9, 13 ou 19 lignes. Le partenaire reçoit le défi dans **Amis**. On retrouve les parties en cours dans **Jouer**, sous **Reprendre une partie**.

## Revue des coups

Pendant la partie, KataGo évalue les positions dans un Web Worker du navigateur. Entre les coups, il approfondit les positions déjà évaluées et conserve les variantes dans IndexedDB sur cet appareil. Le bot adverse a la priorité pendant son tour de calcul.

**Revoir ma partie** utilise les recherches déjà effectuées avant et après chaque coup pour tracer la courbe et attribuer les notes. Quand l’une des deux recherches manque, le bilan compare les évaluations rapides. Chaque position manquante demande un seul passage du réseau. L’onglet Analyse affiche les variantes enregistrées et lance une recherche pour les nouvelles lignes explorées.
