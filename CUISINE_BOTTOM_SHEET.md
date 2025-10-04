# 🍳 Cuisine - Interface Bottom Sheet

## ✅ **Bottom Sheet Implémenté**

### **1. Interface Bottom Sheet**
- **Panneau qui remonte** : Du bas de l'écran
- **Overlay sombre** : Fond semi-transparent
- **Handle de glissement** : Barre en haut pour indiquer qu'on peut glisser
- **Hauteur maximale** : 80% de la hauteur de l'écran

### **2. Structure du Bottom Sheet**
```jsx
{/* Overlay */}
<div className="fixed inset-0 bg-black bg-opacity-50 z-40" />

{/* Bottom Sheet */}
<div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden">
  {/* Handle */}
  <div className="flex justify-center pt-3 pb-2">
    <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
  </div>
  
  {/* Header */}
  <div className="px-4 py-3 border-b border-gray-200">
    {/* Titre et bouton fermer */}
  </div>

  {/* Contenu scrollable */}
  <div className="overflow-y-auto max-h-[60vh]">
    {/* Produits avec quantités */}
  </div>

  {/* Footer avec boutons d'action */}
  <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
    {/* Boutons Annuler et Enregistrer */}
  </div>
</div>
```

## 📱 **Fonctionnalités Mobile-First**

### **1. Overlay et Fermeture**
- **Overlay sombre** : `bg-black bg-opacity-50`
- **Clic pour fermer** : Clic sur l'overlay ferme le bottom sheet
- **Bouton X** : Bouton de fermeture dans le header
- **Z-index élevé** : `z-50` pour être au-dessus de tout

### **2. Handle de Glissement**
- **Barre grise** : `w-12 h-1 bg-gray-300 rounded-full`
- **Centrée** : `flex justify-center`
- **Indication visuelle** : Montre qu'on peut glisser pour fermer
- **Espacement** : `pt-3 pb-2` pour l'espacement

### **3. Header Fixe**
- **Titre du département** : "Production - Crunchfood" ou "Stock - Maged'Abord"
- **Sous-titre** : "Ajustez les quantités directement"
- **Bouton fermer** : X dans le coin droit
- **Bordure** : `border-b border-gray-200` pour séparer

### **4. Contenu Scrollable**
- **Hauteur maximale** : `max-h-[60vh]` (60% de la hauteur de l'écran)
- **Scroll vertical** : `overflow-y-auto`
- **Produits en cartes** : Chaque produit dans sa propre carte
- **Espacement** : `space-y-2` entre les cartes

### **5. Footer Fixe**
- **Boutons d'action** : Annuler et Enregistrer
- **Fond gris** : `bg-gray-50` pour distinguer
- **Bordure** : `border-t border-gray-200` pour séparer
- **Boutons pleine largeur** : `flex-1` pour chaque bouton

## 🎯 **Workflow Bottom Sheet**

### **Étape 1 : Ouverture**
1. **Clic** sur "Production" ou "Stock" d'un département
2. **Bottom sheet** remonte du bas de l'écran
3. **Overlay sombre** apparaît en arrière-plan
4. **Tous les produits** s'affichent dans le panneau

### **Étape 2 : Sélection des Produits**
1. **Scroll** dans le bottom sheet pour voir tous les produits
2. **Clic sur +** pour chaque produit désiré
3. **Ajustement** des quantités avec + et -
4. **Vue d'ensemble** : Tous les produits visibles

### **Étape 3 : Configuration**
1. **Type de mouvement** : Entrée/Sortie pour les stocks
2. **Date** : Sélection de la date
3. **Notes** : Ajout de notes optionnelles
4. **Tout en bas** : Boutons d'action fixes

### **Étape 4 : Enregistrement**
1. **Clic** sur "Enregistrer X éléments"
2. **Sauvegarde** : Tous les éléments avec quantité > 0
3. **Fermeture** : Bottom sheet se ferme automatiquement
4. **Retour** : Interface principale visible

## 🔧 **Fonctionnalités Techniques**

### **1. Positionnement Fixe**
```jsx
<div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden">
  {/* Contenu du bottom sheet */}
</div>
```

### **2. Overlay avec Fermeture**
```jsx
<div 
  className="fixed inset-0 bg-black bg-opacity-50 z-40"
  onClick={() => setShowBulkForm(false)}
/>
```

### **3. Contenu Scrollable**
```jsx
<div className="overflow-y-auto max-h-[60vh]">
  {/* Produits avec quantités */}
</div>
```

### **4. Footer Fixe**
```jsx
<div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
  {/* Boutons d'action */}
</div>
```

## 📊 **Interface Bottom Sheet**

### **Affichage des Produits**
- **Cartes individuelles** : Chaque produit dans sa propre carte
- **Layout en 2 lignes** : Produit/Quantité en haut, boutons en bas
- **Scroll vertical** : Pour voir tous les produits
- **Espacement optimisé** : `space-y-2` entre les cartes

### **Contrôles de Quantité**
- **Boutons centrés** : Au centre de chaque carte
- **Taille tactile** : 40px pour les doigts
- **Espacement** : `space-x-4` entre les boutons
- **États visuels** : Désactivé si quantité = 0

### **Boutons d'Action**
- **Footer fixe** : Toujours visible en bas
- **Boutons pleine largeur** : `flex-1` pour chaque bouton
- **Fond gris** : Pour distinguer du contenu
- **Bordure** : Pour séparer visuellement

## 🎯 **Avantages du Bottom Sheet**

### **Pour les Utilisateurs Mobile**
- ✅ **Interface native** : Ressemble aux apps mobiles
- ✅ **Glissement** : Peut glisser pour fermer
- ✅ **Vue d'ensemble** : Tous les produits visibles
- ✅ **Navigation simple** : Pas de scroll dans la page principale

### **Pour la Productivité**
- ✅ **Saisie rapide** : Boutons + et - intuitifs
- ✅ **Vue d'ensemble** : Tous les produits du département
- ✅ **Moins d'erreurs** : Interface claire et simple
- ✅ **Workflow fluide** : Pas d'étapes intermédiaires

### **Pour la Gestion**
- ✅ **Opérations en lot** : Plusieurs produits en une fois
- ✅ **Quantités précises** : Contrôle exact des montants
- ✅ **Traçabilité** : Chaque produit enregistré séparément
- ✅ **Flexibilité** : Production et stock dans la même interface

## 🚀 **Utilisation**

### **Enregistrer une Production**
1. **Clic** sur "Production" d'un département
2. **Bottom sheet** remonte avec tous les produits
3. **Clic sur +** pour chaque produit désiré
4. **Ajustement** des quantités avec + et -
5. **Saisie** de la date et notes
6. **Clic** sur "Enregistrer X éléments"

### **Enregistrer un Stock**
1. **Clic** sur "Stock" d'un département
2. **Bottom sheet** remonte avec tous les produits
3. **Choix** du type (Entrée/Sortie)
4. **Clic sur +** pour chaque produit désiré
5. **Ajustement** des quantités avec + et -
6. **Clic** sur "Enregistrer X éléments"

---

*L'interface de cuisine utilise maintenant un **bottom sheet** pour afficher les produits avec des **quantités directement visibles** !* 🎉

