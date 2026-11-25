# GobanUp

Club de go en français avec comptes par pseudo, demandes d’amitié, défis privés, salons par lien et recherche d’adversaire. Les comptes et les parties en ligne sont enregistrés dans SQLite. Le bot, les études SGF et l’analyse KataGo fonctionnent dans le navigateur.

## Serveur galagain.com

Le site est accessible sur https://gobanup.galagain.com. Depuis le répertoire du projet, `docker compose up -d --build` construit l’application et démarre le tunnel Cloudflare. Le fichier privé `deploy/tunnel-credentials.json` correspond au tunnel déclaré dans `deploy/tunnel.yml` et se provisionne sur le serveur. Le port local est `127.0.0.1:8093`. La base se trouve dans le volume Docker `gobanup_goban-data`, au chemin `/data/gobanup.sqlite` du conteneur web.

Les migrations SQL du dossier `drizzle` s’appliquent au démarrage. Le serveur utilise Node 24, les sessions utilisent des cookies HTTPS et les mots de passe sont hachés avec PBKDF2-SHA256 et un sel individuel.

## Jouer

Dans **Amis**, créez un compte, puis envoyez une demande au pseudo de votre partenaire. Une fois la demande acceptée, **Inviter à jouer** permet de choisir un goban de 9, 13 ou 19 lignes. Le partenaire reçoit le défi dans **Amis**. On retrouve les parties en cours dans **Jouer**, sous **Reprendre une partie**.

## Revue des coups

**Revoir ma partie** lance une revue sur le serveur. Le service Compose `reviewer` lit une partie à la fois dans SQLite, enregistre chaque verdict et reprend au dernier coup traité après redémarrage. Les deux participants d’un salon consultent la même revue. Les parties du bot et les SGF sont analysés avec leur position initiale, leur ordre de jeu, leurs règles et leur komi.

Le moteur CPU KataGo 1.16.5 cherche le premier choix avec 96 visites. Il approfondit le coup joué depuis la même position si celui-ci a reçu moins de 12 visites. Les seuils initiaux d’imprécision, d’erreur et de gaffe sont de 1, 3 et 6 points. Une baisse de probabilité de victoire peut aussi déclencher un badge. Les positions sont comparées du point de vue du joueur au trait.

Une occasion manquée exige une capture de plusieurs pierres et une réponse qui l’écarte dans la variante étudiée. Sur 19 × 19, un brillant exige un sacrifice avec compensation visible, une probabilité inférieure à 2 % pour le modèle humain 5 kyū, et un premier choix confirmé à 384 visites avec un écart sur la deuxième option. Les badges décrivent des estimations de cette recherche.

Le moteur et les modèles proviennent du [projet KataGo](https://github.com/lightvector/KataGo). Le modèle humain est la [version officielle humanv0](https://github.com/lightvector/KataGo/releases/tag/v1.15.0).
