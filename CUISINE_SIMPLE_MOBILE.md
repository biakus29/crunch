# 🍳 Système de Cuisine Simplifié - Mobile First

## ✅ **Remplacement de la Section Cuisine**

### **Avant :**
- Section "Production" complexe avec de nombreux composants
- Interface non optimisée mobile
- Trop de clics nécessaires
- Accessible aux comptables (non pertinent)

### **Après :**
- Section "Cuisine" ultra-simplifiée
- Interface mobile-first optimisée
- Minimum de clics possible
- Accessible uniquement aux managers (pertinent)

## 🎯 **Fonctionnalités Simplifiées**

### **1. Interface Ultra-Simple**
- **2 boutons principaux** : Production et Stock
- **Sélection rapide** : Département → Produit → Quantité
- **Modal unique** pour toutes les opérations
- **Vue d'ensemble** avec totaux par département

### **2. Départements et Produits**

#### **🥪 Crunchfood**
- Quarts de poulet (pièce) 🍗
- Morceaux de poulet (pièce) 🍖
- Sandwichs (pièce) 🥪
- Mets (portion) 🍽️

#### **🍽️ Manged'Abord**
- Eru (portion) 🥬
- Oko sucre (portion) 🍯
- Okok bassa (portion) 🥘
- Koki (portion) 🍲
- Ndole (portion) 🥗
- Kati-kati (portion) 🍛

### **3. Workflow Ultra-Rapide**

#### **Enregistrer une Production :**
1. **Clic** sur "Production" 
2. **Sélection** du département
3. **Sélection** du produit (unité auto-remplie)
4. **Saisie** de la quantité
5. **Clic** sur "Enregistrer"

#### **Enregistrer un Stock :**
1. **Clic** sur "Stock"
2. **Sélection** du département
3. **Sélection** du produit
4. **Saisie** de la quantité
5. **Choix** Entrée/Sortie (boutons visuels)
6. **Clic** sur "Enregistrer"

## 📱 **Optimisation Mobile-First**

### **Interface Responsive**
```jsx
// Header avec boutons d'action
<div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div className="text-center sm:text-left">
    <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">🍳 Cuisine</h3>
    <p className="text-sm sm:text-base text-gray-600 mt-1">Productions et stocks</p>
  </div>
  <div className="flex gap-2">
    <button className="flex-1 sm:flex-none px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center space-x-2 text-base sm:text-lg">
      <FaPlus />
      <span className="hidden sm:inline">Production</span>
    </button>
    <button className="flex-1 sm:flex-none px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center space-x-2 text-base sm:text-lg">
      <FaBoxes />
      <span className="hidden sm:inline">Stock</span>
    </button>
  </div>
</div>
```

### **Modal Mobile-Optimisée**
- **Hauteur** : `h-[95vh]` sur mobile, `h-auto` sur desktop
- **Largeur** : Pleine largeur sur mobile, `max-w-lg` sur desktop
- **Animation** : Slide up depuis le bas sur mobile
- **Boutons** : Pleine largeur sur mobile, taille fixe sur desktop

### **Tailles de Police Optimisées**
- **Titres** : `text-xl sm:text-2xl`
- **Sous-titres** : `text-lg sm:text-xl`
- **Texte normal** : `text-base sm:text-lg`
- **Texte secondaire** : `text-sm sm:text-base`
- **Boutons** : `text-base sm:text-lg`

## 🔧 **Fonctionnalités Techniques**

### **Collections Firestore**
- `kitchenProductions` : Productions par département
- `kitchenStocks` : Mouvements de stock (entrées/sorties)

### **Calculs Automatiques**
```javascript
// Totaux par département et produit
const getTotals = () => {
  const totals = {};
  
  // Productions
  productions.forEach(prod => {
    if (!totals[prod.department]) {
      totals[prod.department] = {};
    }
    if (!totals[prod.department][prod.product]) {
      totals[prod.department][prod.product] = { production: 0, stock: 0 };
    }
    totals[prod.department][prod.product].production += prod.quantity;
  });

  // Stocks
  stocks.forEach(stock => {
    if (!totals[stock.department]) {
      totals[stock.department] = {};
    }
    if (!totals[stock.department][stock.product]) {
      totals[stock.department][stock.product] = { production: 0, stock: 0 };
    }
    totals[stock.department][stock.product].stock += stock.type === 'in' ? stock.quantity : -stock.quantity;
  });

  return totals;
};
```

### **Interface de Sélection Visuelle**
```jsx
// Type de mouvement de stock avec boutons visuels
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => setForm({ ...form, type: 'in' })}
    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors text-base ${
      form.type === 'in' 
        ? 'border-green-500 bg-green-50 text-green-700' 
        : 'border-gray-300 text-gray-700'
    }`}
  >
    <FaArrowUp className="inline mr-2" />
    Entrée
  </button>
  <button
    type="button"
    onClick={() => setForm({ ...form, type: 'out' })}
    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors text-base ${
      form.type === 'out' 
        ? 'border-red-500 bg-red-50 text-red-700' 
        : 'border-gray-300 text-gray-700'
    }`}
  >
    <FaArrowDown className="inline mr-2" />
    Sortie
  </button>
</div>
```

## 🎯 **Avantages du Système Simplifié**

### **Pour les Utilisateurs**
- ✅ **2 clics maximum** pour enregistrer une opération
- ✅ **Interface intuitive** avec icônes et couleurs
- ✅ **Mobile-first** : Parfait sur tous les appareils
- ✅ **Feedback visuel** immédiat

### **Pour la Gestion**
- ✅ **Vue d'ensemble** des totaux par département
- ✅ **Historique complet** des opérations
- ✅ **Calculs automatiques** des stocks
- ✅ **Traçabilité** des productions

### **Pour le Développement**
- ✅ **Code simplifié** et maintenable
- ✅ **Composant unique** pour toutes les opérations
- ✅ **Collections Firestore** optimisées
- ✅ **Permissions** appropriées (Manager uniquement)

## 🚀 **Utilisation**

### **Accès**
- **Menu** : "Cuisine" avec icône 🍳
- **Permissions** : Manager uniquement
- **Section** : `kitchen`

### **Workflow Typique**
1. **Ouvrir** la section Cuisine
2. **Voir** les totaux par département
3. **Enregistrer** une production : Clic Production → Département → Produit → Quantité → Enregistrer
4. **Enregistrer** un stock : Clic Stock → Département → Produit → Quantité → Entrée/Sortie → Enregistrer
5. **Consulter** l'historique des opérations

---

*Le système de cuisine est maintenant **ultra-simplifié**, **mobile-first** et **optimisé** pour un usage rapide !* 🎉

