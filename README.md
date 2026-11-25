# GobanUp

Club de go en français avec comptes par pseudo, demandes d’amitié, défis privés, salons par lien et recherche d’adversaire. Les comptes et les parties en ligne sont enregistrés dans SQLite. Le bot, les études SGF et l’analyse KataGo fonctionnent dans le navigateur.

## Serveur galagain.com

Le site est accessible sur https://gobanup.galagain.com. Depuis le répertoire du projet, `docker compose up -d --build` construit l’application et démarre le tunnel Cloudflare. Le fichier privé `deploy/tunnel-credentials.json` correspond au tunnel déclaré dans `deploy/tunnel.yml` et se provisionne sur le serveur. Le port local est `127.0.0.1:8093`. La base se trouve dans le volume Docker `gobanup_goban-data`, au chemin `/data/gobanup.sqlite` du conteneur web.

Les migrations SQL du dossier `drizzle` s’appliquent au démarrage. Le serveur utilise Node 24, les sessions utilisent des cookies HTTPS et les mots de passe sont hachés avec PBKDF2-SHA256 et un sel individuel.

## Jouer

Dans **Amis**, créez un compte, puis envoyez une demande au pseudo de votre partenaire. Une fois la demande acceptée, **Inviter à jouer** permet de choisir un goban de 9, 13 ou 19 lignes. Le partenaire reçoit le défi dans **Amis**. On retrouve les parties en cours dans **Jouer**, sous **Reprendre une partie**.

## Revue des coups

**Revoir ma partie** lance KataGo dans un Web Worker du navigateur. Les estimations terminées sont conservées dans IndexedDB et réutilisées à la prochaine ouverture de la même partie sur cet appareil. Le serveur distribue les fichiers du moteur et du modèle.

Le bilan évalue la position initiale une fois, puis chaque coup avec un seul passage du réseau. Ce passage produit ensemble le score, les chances de victoire et les préférences de coups. La courbe et les notes utilisent la variation avant et après le coup joué. La recherche de variantes s’effectue dans l’onglet Analyse.
