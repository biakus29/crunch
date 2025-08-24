# Correction de l'erreur d'assertion interne Firestore

## Problème résolu
Erreur: `FIRESTORE (11.4.0) INTERNAL ASSERTION FAILED: Unexpected state`

## Cause identifiée
L'erreur était causée par la persistance hors ligne de Firestore (`enableIndexedDbPersistence`) qui peut créer des conflits d'état interne, particulièrement :
- Lors de l'ouverture de plusieurs onglets
- Avec certaines versions de navigateurs
- En mode développement avec rechargements fréquents

## Solution implémentée

### Désactivation temporaire de la persistance hors ligne
Dans le fichier `src/firebase.js` :
- Commenté l'appel à `enableIndexedDbPersistence(db)`
- Défini `persistenceInitialized = true` directement
- Ajouté un message de log explicatif

### Code modifié
```javascript
// Persistance hors ligne désactivée temporairement pour éviter les erreurs d'assertion interne
let persistenceInitialized = true;
console.log("Persistance hors ligne désactivée pour éviter les conflits d'état.");
```

## Impact
- ✅ Erreur d'assertion interne résolue
- ✅ Application fonctionne normalement
- ⚠️ Pas de cache hors ligne (données rechargées à chaque visite)
- ✅ Toutes les fonctionnalités Firebase restent opérationnelles

## Réactivation optionnelle
Si la persistance hors ligne est nécessaire en production :
1. Décommenter le code dans `firebase.js`
2. Tester en production avec un seul onglet
3. Surveiller les logs pour détecter d'éventuels conflits

## Alternative recommandée
Pour éviter les conflits tout en gardant une forme de cache :
- Utiliser le cache navigateur standard
- Implémenter un cache applicatif personnalisé
- Utiliser `getDocsFromCache()` de manière sélective

## Fichiers modifiés
- `src/firebase.js`: Désactivation de la persistance IndexedDB