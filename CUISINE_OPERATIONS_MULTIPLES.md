# 🍳 Système de Cuisine - Opérations Multiples

## ✅ **Nouvelles Fonctionnalités Implémentées**

### **1. Opérations en Lot**
- **Productions Multiples** : Sélectionner plusieurs produits d'un département en une fois
- **Stocks Multiples** : Gérer plusieurs mouvements de stock simultanément
- **Interface intuitive** : Voir tous les produits disponibles sans passer par des listes

### **2. Interface Optimisée**

#### **4 Boutons d'Action**
```jsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
  <button onClick={() => openModal('production')}>
    <FaPlus /> Production
  </button>
  <button onClick={() => openModal('stock')}>
    <FaBoxes /> Stock
  </button>
  <button onClick={() => openModal('bulk_production')}>
    <FaUtensils /> Prod. Multiple
  </button>
  <button onClick={() => openModal('bulk_stock')}>
    <FaBoxes /> Stock Multiple
  </button>
</div>
```

#### **Interface Mobile-First**
- **Grid responsive** : 2 colonnes sur mobile, 4 sur desktop
- **Boutons compacts** : Texte court sur mobile, complet sur desktop
- **Icônes adaptatives** : Tailles différentes selon l'écran

### **3. Modal Intelligent**

#### **Interface pour Opérations Simples**
- Sélection du département
- Choix du produit (dropdown)
- Saisie de la quantité
- Type de mouvement (pour stocks)
- Date et notes

#### **Interface pour Opérations Multiples**
- **Sélection du département** : Affiche tous les produits disponibles
- **Grille de produits** : Tous les produits visibles avec icônes
- **Ajout par clic** : Clic sur un produit pour l'ajouter
- **Gestion des quantités** : Modification directe des quantités
- **Suppression facile** : Bouton X pour retirer un produit

## 🔧 **Fonctionnalités Techniques**

### **1. Gestion des États**
```javascript
const [bulkForm, setBulkForm] = useState({
  department: '',
  date: new Date().toISOString().split('T')[0],
  type: 'in',
  items: [], // [{ productId, productName, quantity, unit }]
  notes: ''
});
```

### **2. Fonctions de Gestion**
```javascript
// Ajouter un produit à la sélection
const addBulkItem = (productId, productName, unit) => {
  const existingItem = bulkForm.items.find(item => item.productId === productId);
  if (existingItem) {
    // Incrémenter la quantité si déjà présent
    setBulkForm(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    }));
  } else {
    // Ajouter un nouveau produit
    setBulkForm(prev => ({
      ...prev,
      items: [...prev.items, { productId, productName, quantity: 1, unit }]
    }));
  }
};

// Mettre à jour une quantité
const updateBulkItem = (productId, field, value) => {
  setBulkForm(prev => ({
    ...prev,
    items: prev.items.map(item =>
      item.productId === productId
        ? { ...item, [field]: value }
        : item
    )
  }));
};

// Supprimer un produit
const removeBulkItem = (productId) => {
  setBulkForm(prev => ({
    ...prev,
    items: prev.items.filter(item => item.productId !== productId)
  }));
};
```

### **3. Sauvegarde en Lot**
```javascript
const saveBulkData = async () => {
  try {
    if (!bulkForm.department || bulkForm.items.length === 0) {
      toast.error('Sélectionnez un département et au moins un produit');
      return;
    }

    const collectionName = modalType === 'bulk_production' ? 'kitchenProductions' : 'kitchenStocks';
    
    // Créer un enregistrement pour chaque produit
    const promises = bulkForm.items.map(item => {
      if (item.quantity > 0) {
        const data = {
          department: bulkForm.department,
          product: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          date: bulkForm.date,
          type: bulkForm.type,
          notes: bulkForm.notes,
          restaurantId: currentRestaurantId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        return addDoc(collection(db, collectionName), data);
      }
      return null;
    }).filter(Boolean);

    const refs = await Promise.all(promises);
    
    // Mettre à jour l'état local
    const newItems = refs.map((ref, index) => ({
      id: ref.id,
      department: bulkForm.department,
      product: bulkForm.items[index].productId,
      quantity: bulkForm.items[index].quantity,
      unit: bulkForm.items[index].unit,
      date: bulkForm.date,
      type: bulkForm.type,
      notes: bulkForm.notes,
      restaurantId: currentRestaurantId
    }));

    if (modalType === 'bulk_production') {
      setProductions(prev => [...newItems, ...prev]);
    } else {
      setStocks(prev => [...newItems, ...prev]);
    }

    toast.success(`${newItems.length} éléments enregistrés avec succès`);
    closeModal();
  } catch (error) {
    console.error('Erreur sauvegarde en lot:', error);
    toast.error('Erreur lors de la sauvegarde en lot');
  }
};
```

## 🎯 **Interface Utilisateur**

### **1. Sélection des Produits**
```jsx
{/* Liste des produits du département */}
{bulkForm.department && (
  <div>
    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Produits disponibles</label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
      {PRODUCTS[bulkForm.department]?.map(product => (
        <button
          key={product.id}
          onClick={() => addBulkItem(product.id, product.name, product.unit)}
          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">{product.icon}</span>
            <span className="text-sm sm:text-base font-medium">{product.name}</span>
          </div>
          <FaPlus className="text-blue-600 text-sm" />
        </button>
      ))}
    </div>
  </div>
)}
```

### **2. Produits Sélectionnés**
```jsx
{/* Produits sélectionnés */}
{bulkForm.items.length > 0 && (
  <div>
    <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">Produits sélectionnés</label>
    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
      {bulkForm.items.map(item => (
        <div key={item.productId} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{PRODUCTS[bulkForm.department]?.find(p => p.id === item.productId)?.icon}</span>
            <span className="text-sm sm:text-base font-medium">{item.productName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={item.quantity}
              onChange={(e) => updateBulkItem(item.productId, 'quantity', Number(e.target.value))}
              className="w-16 px-2 py-1 border rounded text-center text-sm"
              min="0"
              step="0.1"
            />
            <span className="text-xs text-gray-500">{item.unit}</span>
            <button
              onClick={() => removeBulkItem(item.productId)}
              className="text-red-600 hover:text-red-800 p-1"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

## 🚀 **Workflow Optimisé**

### **Opération Simple**
1. **Clic** sur "Production" ou "Stock"
2. **Sélection** du département
3. **Choix** du produit (dropdown)
4. **Saisie** de la quantité
5. **Enregistrement** en un clic

### **Opération Multiple**
1. **Clic** sur "Prod. Multiple" ou "Stock Multiple"
2. **Sélection** du département
3. **Clic** sur les produits désirés (tous visibles)
4. **Ajustement** des quantités
5. **Enregistrement** de tous les éléments en une fois

## 📱 **Optimisations Mobile-First**

### **Responsive Design**
- **Mobile** : 2 colonnes pour les boutons d'action
- **Desktop** : 4 colonnes pour tous les boutons
- **Grille de produits** : 1 colonne sur mobile, 2 sur desktop
- **Hauteur maximale** : `max-h-48` avec scroll pour les listes

### **Interactions Tactiles**
- **Boutons de produits** : Taille suffisante pour les doigts
- **Inputs de quantité** : Centrés et faciles à modifier
- **Boutons de suppression** : Icônes claires et accessibles

## 🎯 **Avantages du Système**

### **Pour les Utilisateurs**
- ✅ **Vue d'ensemble** : Tous les produits visibles d'un coup
- ✅ **Sélection rapide** : Clic pour ajouter, pas de navigation
- ✅ **Gestion en lot** : Plusieurs éléments en une opération
- ✅ **Interface intuitive** : Pas besoin de passer par des listes

### **Pour la Productivité**
- ✅ **Gain de temps** : Moins de clics et de navigation
- ✅ **Erreurs réduites** : Interface claire et directe
- ✅ **Workflow fluide** : Opérations simples et multiples
- ✅ **Feedback visuel** : Confirmation des sélections

### **Pour la Gestion**
- ✅ **Saisie rapide** : Idéal pour les inventaires
- ✅ **Flexibilité** : Opérations individuelles ou en lot
- ✅ **Traçabilité** : Chaque élément enregistré séparément
- ✅ **Cohérence** : Même interface pour tous les types d'opérations

---

*Le système de cuisine permet maintenant de **voir tous les éléments des départements** et de **sélectionner plusieurs productions ou stocks** en une seule opération !* 🎉

