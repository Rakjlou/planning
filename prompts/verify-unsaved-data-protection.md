# Vérification : Protection contre la perte de données non sauvegardées

## Contexte

On a ajouté un système de dirty-checking + `confirm()` natif pour empêcher la perte silencieuse de données lors de l'édition de tâches/phases dans le dashboard retroplanning.

**Fichiers modifiés** :
- `public/js/dashboard.js` — helpers `hasUnsavedNewTask()`, `hasUnsavedEditTask()`, `hasUnsavedEditPhase()`, `guardedCancelAllEditing()`
- `views/dashboard.ejs` — body handlers remplacés par `guardedCancelAllEditing()`
- `views/partials/_add-task-form.ejs` — bouton "+ Ajouter" et bouton Annuler gardés
- `views/partials/_task-row.ejs` — clic ligne et bouton Annuler gardés
- `views/partials/_phase-card.ejs` — bouton éditer phase et bouton Annuler gardés

## Prérequis

- Le serveur tourne sur `http://localhost:3000` (lancer `npm run dev` si besoin)
- Il faut au moins une phase avec des tâches existantes dans le dashboard

## Scénarios à tester dans Chrome

### 1. Création de tâche — clic dehors avec données saisies
1. Ouvrir une phase (cliquer sur son en-tête pour la déplier)
2. Cliquer "+ Ajouter une tâche"
3. Taper du texte dans le champ "Description de la tâche" (ex: "Test tâche")
4. Cliquer sur le fond de la page (zone grise en dehors de tout formulaire/carte)
5. **Attendu** : un `confirm()` natif apparaît avec "Vous avez des modifications non enregistrées. Abandonner ?"
6. Cliquer "Annuler" dans le dialog → le formulaire reste ouvert avec le texte saisi
7. Re-cliquer sur le fond → re-confirmer → cliquer "OK" → le formulaire se ferme

### 2. Création de tâche — clic dehors sans données
1. Cliquer "+ Ajouter une tâche"
2. Ne rien taper
3. Cliquer sur le fond de la page
4. **Attendu** : le formulaire se ferme silencieusement, PAS de dialog de confirmation

### 3. Changement de phase pendant la création
1. Ouvrir deux phases
2. Cliquer "+ Ajouter une tâche" dans la phase A
3. Taper du texte dans le champ description
4. Cliquer "+ Ajouter une tâche" dans la phase B
5. **Attendu** : dialog de confirmation
6. "Annuler" → le formulaire phase A reste ouvert
7. Refaire → "OK" → le formulaire phase A se ferme, celui de phase B s'ouvre vide

### 4. Édition de tâche existante — Escape avec modifications
1. Cliquer sur une tâche existante pour l'éditer
2. Modifier le texte de la tâche
3. Appuyer sur Escape
4. **Attendu** : dialog de confirmation
5. "Annuler" → reste en mode édition avec les modifications
6. Re-Escape → "OK" → quitte l'édition, les modifications sont annulées

### 5. Édition de tâche existante — Escape sans modifications
1. Cliquer sur une tâche existante pour l'éditer
2. Ne rien modifier
3. Appuyer sur Escape
4. **Attendu** : fermeture silencieuse, pas de dialog

### 6. Bouton Annuler (×) du formulaire de création
1. Cliquer "+ Ajouter une tâche"
2. Taper du texte
3. Cliquer le bouton × (Annuler) du formulaire
4. **Attendu** : dialog de confirmation (le bouton Annuler respecte le même garde que le clic dehors)

### 7. Bouton Annuler (×) de l'édition de tâche
1. Cliquer sur une tâche pour l'éditer
2. Modifier le texte
3. Cliquer le bouton × (Annuler)
4. **Attendu** : dialog de confirmation

### 8. Édition de phase — même logique
1. Cliquer le bouton crayon d'une phase pour la renommer
2. Modifier le nom
3. Cliquer sur le fond de la page
4. **Attendu** : dialog de confirmation

### 9. Sauvegarde puis navigation — pas de faux positif
1. Cliquer "+ Ajouter une tâche", taper du texte, cliquer le bouton ✓ (valider) pour sauvegarder
2. Cliquer ensuite sur le fond de la page
3. **Attendu** : pas de dialog (le formulaire est déjà fermé/réinitialisé après la sauvegarde)

## Critères de succès

- Aucune perte silencieuse de données quand l'utilisateur a saisi quelque chose
- Aucune friction inutile quand le formulaire est vide/non modifié
- Le `confirm()` natif du navigateur s'affiche correctement
- "Annuler" dans le dialog conserve l'état du formulaire intact
- "OK" dans le dialog ferme le formulaire et réinitialise les données
