# Démo RentCar : guide de test manuel

Une démo complète, avec des données réalistes, sur **sa propre base de données** : vos vraies données ne sont jamais touchées.

## Lancer la démo

```bash
./demo.sh          # démarre la démo (crée et remplit la base la première fois)
./demo.sh reset    # remet des données neuves (les dates suivent la date du jour)
./demo.sh stop     # arrête la démo
```

| | |
|---|---|
| Site | http://localhost:5180 |
| Administration | http://localhost:5180/login |
| Propriétaire | `admin` / `demo1234` |
| Agent (droits limités) | `agent` / `demo1234` |

**Avant de commencer :** PostgreSQL doit tourner, et `server/.env` doit contenir vos clés Cloudinary, SMTP (Gmail) et Turnstile. Les clients de démo « Aymen Test Démo » et « Leila Test Démo » utilisent **votre adresse Gmail** (`SMTP_USER`) : c’est là que vous recevrez les codes, contrats et rappels. Les autres clients de démo n’ont pas d’e-mail.

**Ce que contient la démo :** 10 voitures avec plaques et papiers, 22 réservations dans tous les états (dont 12 terminées sur 12 mois), un client fidèle, un client bloqué, une amende, 14 dépenses, un compte agent. Réglages : week-end +10 %, été (1er juillet – 31 août) +25 %, 250 km/jour inclus puis 0,3 DT/km, 15 DT par huitième de carburant manquant, caution 500 DT, âge minimum 21 ans, permis depuis 2 ans.

> Astuce : cochez les cases au fur et à mesure (dans VS Code : aperçu Markdown). Si un résultat ne correspond pas à ce qui est attendu, notez le numéro du scénario.

---

## A. Côté client (site public)

### A1. Langues
- [ ] Sur la page d’accueil, passez en **FR**, **EN** puis **AR** (en haut à droite).
- **Attendu :** tout le site change de langue ; en arabe, la page passe de droite à gauche et les prix s’affichent en « د.ت ».

### A2. La flotte
- [ ] Descendez jusqu’à « Nos véhicules », testez la recherche (« BMW »), le filtre par marque et « Disponibles uniquement ».
- [ ] Repérez le **Dacia Duster**.
- **Attendu :** le Dacia est marqué **Indisponible** : sa vignette est expirée, il ne peut pas être réservé.

### A3. Page d’une voiture
- [ ] Cliquez sur une voiture (pas sur « Réserver »).
- **Attendu :** page détaillée avec photos, caractéristiques, équipements, prix.

### A4. Réservation en ligne
Ouvrez **Renault Clio 5** → **Réserver**.
- [ ] **Calendrier :** les jours déjà réservés sont barrés et impossibles à choisir.
- [ ] Choisissez un séjour qui **inclut un samedi** : la ligne de prix affiche un tarif « week-end » (+10 %).
- [ ] Allez sur **juillet de l’année prochaine** : le tarif « Été » (+25 %) apparaît.
- [ ] Choisissez **7 jours ou plus** : la remise longue durée (-10 %) apparaît.
- [ ] Cochez une option (GPS) et « Livraison à mon adresse » : +30 DT, et l’adresse devient obligatoire.
- [ ] Mettez une **date de naissance de moins de 21 ans** → **Attendu :** message « au moins 21 ans ».
- [ ] Mettez un **permis délivré il y a moins de 2 ans** → **Attendu :** message sur l’ancienneté du permis.
- [ ] Corrigez, indiquez **votre e-mail**, choisissez la langue des e-mails, cochez « Je suis humain » (Cloudflare), puis confirmez.
- **Attendu :** une **référence** `RC-XXXXXX` s’affiche, et vous recevez l’e-mail « demande reçue » dans la langue choisie.

### A5. Suivre sa réservation
- [ ] Menu **Ma réservation** → saisissez la référence de A4 et votre téléphone.
- [ ] Essayez avec un **autre** numéro de téléphone.
- **Attendu :** avec le bon numéro, le statut s’affiche (« En attente de confirmation ») avec le détail du prix ; avec un autre numéro : « aucune réservation trouvée ».

### A6. Client bloqué
- [ ] Réservez n’importe quelle voiture avec le téléphone **+216 50 123 987**.
- **Attendu :** refus (« nous ne pouvons pas accepter de réservation en ligne pour ce numéro »).

### A7. WhatsApp
- [ ] Cliquez sur la bulle verte en bas de l’écran.
- **Attendu :** sur ordinateur, WhatsApp Web s’ouvre sur le numéro de l’agence avec un message pré-rempli.

---

## B. Administration (connectez-vous avec `admin` / `demo1234`)

### B1. Tableau de bord
- [ ] **Attendu :** 3 locations en cours, revenus sur 12 mois, et le bloc « Car papers & service » : **Dacia** vignette expirée, **Tesla** assurance bientôt expirée, **Clio** entretien à faire, **Polo** visite technique proche.
- [ ] Bloc « Late returns » : **Anis Chebbi** devait rendre le Dacia hier → bouton WhatsApp avec un message de relance.
- [ ] Bloc « Unpaid balances » : **Walid Sassi** et **Riadh Mejri**.
- [ ] Bloc « Next 7 days » : bouton **Remind** → message WhatsApp de rappel dans la langue du client.

### B2. Réservations
- [ ] Menu **Bookings** : cherchez « Rim », filtrez par statut « Pending », exportez en **CSV**.
- [ ] Ouvrez **Rim Chaabane** → **Approve**.
- **Attendu :** le statut passe à « Approved ». (Rim n’a pas d’e-mail : aucun e-mail n’est envoyé.)
- [ ] Ouvrez votre réservation de A4 → **Approve**.
- **Attendu :** vous recevez l’e-mail « réservation confirmée ».

### B3. Contrat signé en ligne ⭐
1. [ ] Ouvrez **Aymen Test Démo** (BMW M4, départ aujourd’hui) → section « Online contract signature » → **Send for signature**.
2. [ ] **Attendu :** vous recevez l’e-mail « Merci de signer votre contrat », et le lien s’affiche aussi dans l’admin (bouton WhatsApp).
3. [ ] Ouvrez le lien (idéalement dans une fenêtre étroite, comme un téléphone) → « Lire le contrat complet (PDF) ».
   - **Attendu :** un PDF marqué **APERÇU – NON SIGNÉ**.
4. [ ] **Recevoir le code** → saisissez d’abord un **mauvais code**.
   - **Attendu :** « Code incorrect ».
5. [ ] Saisissez le bon code reçu par e-mail, signez au doigt ou à la souris, acceptez, puis **Signer le contrat**.
   - **Attendu :** « Contrat signé » avec un **code de vérification**, et un e-mail avec le **PDF signé** en pièce jointe.
6. [ ] Rouvrez le même lien.
   - **Attendu :** « Ce contrat est déjà signé ».
7. [ ] Dans l’admin, la fiche indique **Signed online** (nom, date, IP) et propose **Signed contract (PDF)**.
8. [ ] Ouvrez **Verification page**, puis déposez le PDF reçu par e-mail.
   - **Attendu :** « Contrat authentique » et « n’a pas été modifié ».
9. [ ] Modifiez une copie du PDF (par exemple : ouvrez-la et réenregistrez-la avec un autre logiciel), puis déposez-la.
   - **Attendu :** « NE correspond PAS ».

Variante : **Leila Test Démo** a les e-mails **en arabe** (l’e-mail de rappel « demain » lui a déjà été envoyé au démarrage de la démo).

### B4. Remise de la voiture (état des lieux de départ)
- [ ] Toujours sur **Aymen Test Démo** → **Start pick-up**.
- [ ] Ajoutez **au moins 4 photos**. Sur ordinateur, choisissez des images ; sur téléphone, l’appareil photo s’ouvre.
- [ ] Touchez la voiture pour marquer un dommage (ex. « rayure portière »), vérifiez le kilométrage et le carburant, complétez CIN / permis.
- [ ] Cochez l’acceptation des conditions, faites signer, puis **Confirm pick-up**.
- **Attendu :** « Car handed over » ; vous recevez le **contrat PDF** avec les photos, le schéma des dommages et la signature.

### B5. Retour avec frais automatiques
- [ ] Ouvrez **Fatma Zouari** (Hyundai Tucson, en cours) → **Return car**.
- [ ] Ajoutez 4 photos, mettez un kilométrage de **+1 300 km** par rapport au départ (12 400 → **13 700**) et le carburant à **6/8**.
- **Attendu :**
  - l’encadré « Charges so far » montre les km au-delà du forfait et le carburant manquant ;
  - après confirmation : « Car returned », le **solde dû**, et le **rapport de retour** en PDF (comparaison départ / retour).

### B6. Retour en retard
- [ ] Ouvrez **Anis Chebbi** (Dacia, en retard) → **Return car** → confirmez.
- **Attendu :** une ligne « Late return » ajoutée automatiquement (une journée par jour entamé).

### B7. Frais manuels et paiements
- [ ] Ouvrez **Walid Sassi** : frais déjà présents (carburant, bosse, amende radar), dommage visible au retour dans le rapport.
- [ ] Ajoutez un frais manuel, puis supprimez-le ; enregistrez un paiement (**Paid in full**).
- **Attendu :** il disparaît du bloc « Unpaid balances » du tableau de bord.

### B8. Amendes ⭐
- [ ] Menu **History** → ouvrez **Hedi Kefi** et notez ses dates (location de la Renault Clio, il y a environ 10 jours).
- [ ] Menu **Fines** → plaque **215 TU 4481**, une date **entre son départ et son retour**, heure **11:45**, montant 40, description « Radar » → **Who had the car?**
- **Attendu :** Hedi Kefi est trouvé (« recorded at pick-up/return ») → **Charge 40 DT to Hedi** ajoute l’amende à sa facture.
- [ ] Refaites la recherche avec une date où la voiture était à l’agence.
- **Attendu :** « the car was with the agency ».

### B9. Papiers et entretien
- [ ] **Manage Cars** → le Dacia affiche « Expired: Vignette · not bookable ». Modifiez-le et mettez une date de vignette dans le futur.
- **Attendu :** le Dacia redevient réservable sur le site.
- [ ] Essayez de créer une réservation approuvée pour la **Tesla** qui se termine **après le 5e jour** à partir d’aujourd’hui.
- **Attendu :** refus, car l’assurance expire avant la fin de la location.

### B10. Rentabilité par voiture
- [ ] Menu **Profit per Car**.
- **Attendu :** revenus, dépenses et profit par voiture sur 12 mois (la G-Class a de grosses dépenses d’assurance).
- [ ] Ajoutez une dépense : le profit de la voiture baisse d’autant.

### B11. Clients
- [ ] Menu **Customers** : **Mohamed Ben Ali** a 3 locations, alors que son numéro est écrit de 3 façons différentes. Il est marqué « repeat ».
- [ ] **Riadh Mejri** est **bloqué** (motif affiché) ; débloquez-le puis rebloquez-le.

### B12. Calendrier de la flotte
- [ ] Menu **Calendar** : barres colorées par statut. Cliquez sur une barre pour ouvrir la réservation.

### B13. Réglages
- [ ] **Settings** : changez le pourcentage week-end, ajoutez une saison, modifiez le forfait km et les conditions du contrat.
- **Attendu :** le prix affiché dans le formulaire de réservation du site change immédiatement.

### B14. Rôles : propriétaire / agent
- [ ] Déconnectez-vous et connectez-vous en **`agent` / `demo1234`**.
- **Attendu :** pas de menus « Team » ni « Activity Log », pas de bouton « Delete » sur les voitures et réservations ; l’agent peut quand même approuver, faire les remises et les retours.
- [ ] Reconnectez-vous en `admin` → **Activity Log**.
- **Attendu :** chaque action faite pendant le test est tracée, y compris « customer: … » pour la signature en ligne.

---

## C. E-mails automatiques

Tous les e-mails de démo arrivent dans **votre Gmail** (pensez à regarder aussi dans *Spam* et *Promotions*).

| Quand | E-mail |
|---|---|
| Réservation en ligne (A4) | Demande reçue |
| Approbation (B2) | Réservation confirmée |
| Envoi du contrat (B3) | Lien de signature, puis code à 6 chiffres, puis contrat signé en PDF |
| Remise (B4) | Contrat + état des lieux en PDF |
| Retour (B5) | Rapport de retour en PDF |
| Veille du départ | Rappel (déjà envoyé à Leila, en arabe, au lancement de la démo) |
| Papiers de voitures | Récapitulatif des alertes envoyé à l’agence |

## Recommencer

`./demo.sh reset` remet toutes les données de démo à neuf. Les dates sont recalculées à partir du jour même, donc les scénarios « aujourd’hui », « demain » et « en retard » restent valables.
