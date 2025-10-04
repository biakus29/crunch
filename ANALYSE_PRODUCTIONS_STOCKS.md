# 📊 Analyse des Productions et Stocks par Département

## 🎯 **Objectif**
Analyser et gérer les productions et stocks pour les deux départements :
- **🥪 Crunchfood** : Quarts de poulet, morceaux de poulet, sandwichs et mets
- **🍽️ Manged'Abord** : Eru, oko sucre, okok bassa, koki, ndole et kati-kati

## 🏢 **Départements et Produits**

### **🥪 Crunchfood**
| Produit | Unité | Icône | Description |
|---------|-------|-------|-------------|
| Quarts de poulet | pièce | 🍗 | Portions de poulet |
| Morceaux de poulet | pièce | 🍖 | Morceaux individuels |
| Sandwichs | pièce | 🥪 | Sandwichs variés |
| Mets | portion | 🍽️ | Plats préparés |

### **🍽️ Manged'Abord**
| Produit | Unité | Icône | Description |
|---------|-------|-------|-------------|
| Eru | portion | 🥬 | Plat traditionnel aux légumes |
| Oko sucre | portion | 🍯 | Plat sucré traditionnel |
| Okok bassa | portion | 🥘 | Plat aux feuilles de manioc |
| Koki | portion | 🍲 | Plat aux haricots |
| Ndole | portion | 🥗 | Plat aux feuilles de ndole |
| Kati-kati | portion | 🍛 | Plat traditionnel |

## 🔧 **Système de Gestion Créé**

### **1. Composant Principal : `DepartmentProductionManager`**

#### **Fonctionnalités**
- **Gestion des productions** par département et produit
- **Gestion des stocks** (entrées et sorties)
- **Tableau de bord** avec résumé par département
- **Interface mobile-first** optimisée
- **CRUD complet** pour toutes les opérations

#### **Collections Firestore**
- `departmentProductions` : Enregistrements de production
- `departmentStocks` : Mouvements de stock (entrées/sorties)

### **2. Interface Utilisateur**

#### **Vue d'Ensemble**
```jsx
// Résumé par département avec totaux
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {Object.entries(DEPARTMENTS).map(([deptKey, dept]) => (
    <div key={deptKey} className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
      {/* Header du département */}
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl" style={{ backgroundColor: dept.color }}>
          {dept.label.split(' ')[0]}
        </div>
        <div>
          <h4 className="text-lg sm:text-xl font-semibold text-gray-800">{dept.label}</h4>
          <p className="text-sm sm:text-base text-gray-600">Productions et stocks</p>
        </div>
      </div>
      
      {/* Liste des produits avec totaux */}
      <div className="space-y-3">
        {dept.products.map(product => (
          <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            {/* Produit avec icône */}
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{product.icon}</span>
              <div>
                <p className="font-medium text-gray-800 text-sm sm:text-base">{product.name}</p>
                <p className="text-xs sm:text-sm text-gray-500">Unité: {product.unit}</p>
              </div>
            </div>
            
            {/* Totaux de production et stock */}
            <div className="text-right">
              <div className="flex space-x-4 text-sm sm:text-base">
                <div>
                  <p className="text-gray-500 text-xs">Production</p>
                  <p className="font-bold text-blue-600">{productionTotal}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Stock</p>
                  <p className={`font-bold ${stockCurrent > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stockCurrent}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ))}
</div>
```

#### **Modal de Création/Édition**
- **Sélection du département** : Dropdown avec couleurs distinctives
- **Sélection du produit** : Dynamique selon le département choisi
- **Saisie des quantités** : Avec unités automatiques
- **Type de mouvement** : Entrée/Sortie pour les stocks
- **Date et notes** : Pour traçabilité complète

### **3. Calculs et Totaux**

#### **Productions**
```javascript
const getProductionTotals = () => {
  const totals = {};
  productions.forEach(prod => {
    if (!totals[prod.department]) {
      totals[prod.department] = {};
    }
    if (!totals[prod.department][prod.product]) {
      totals[prod.department][prod.product] = 0;
    }
    totals[prod.department][prod.product] += prod.quantity;
  });
  return totals;
};
```

#### **Stocks**
```javascript
const getStockTotals = () => {
  const totals = {};
  stocks.forEach(stock => {
    if (!totals[stock.department]) {
      totals[stock.department] = {};
    }
    if (!totals[stock.department][stock.product]) {
      totals[stock.department][stock.product] = { in: 0, out: 0 };
    }
    totals[stock.department][stock.product][stock.type] += stock.quantity;
  });
  return totals;
};
```

### **4. Intégration dans le Système**

#### **Permissions**
- **Manager** : Accès complet à la gestion des productions et stocks
- **Accountant** : Accès en lecture et modification des données financières

#### **Navigation**
- **Menu** : "Productions & Stocks" avec icône `FaCogs`
- **Section** : `departmentProduction`
- **Route** : Intégrée dans `restaurantadmin.jsx`

## 📱 **Interface Mobile-First**

### **Responsive Design**
- **Mobile** : Layout vertical avec cartes empilées
- **Tablet** : Grille 2 colonnes pour les départements
- **Desktop** : Layout complet avec tableaux détaillés

### **Tailles de Police**
- **Titres** : `text-xl sm:text-2xl`
- **Sous-titres** : `text-lg sm:text-xl`
- **Texte normal** : `text-base sm:text-lg`
- **Texte secondaire** : `text-sm sm:text-base`

## 🎯 **Avantages du Système**

### **Pour la Gestion**
- ✅ **Séparation claire** des départements
- ✅ **Traçabilité complète** des productions et stocks
- ✅ **Calculs automatiques** des totaux
- ✅ **Interface intuitive** et mobile-friendly

### **Pour les Utilisateurs**
- ✅ **Vue d'ensemble** des performances par département
- ✅ **Saisie rapide** des productions et mouvements
- ✅ **Historique complet** des opérations
- ✅ **Alertes visuelles** pour les stocks faibles

### **Pour l'Analyse**
- ✅ **Données structurées** par département et produit
- ✅ **Métriques claires** de production et stock
- ✅ **Rapports détaillés** possibles
- ✅ **Intégration** avec le système de rapports existant

## 🚀 **Utilisation**

### **Enregistrer une Production**
1. Cliquer sur "Nouvelle Production"
2. Sélectionner le département (Crunchfood ou Manged'Abord)
3. Choisir le produit dans la liste
4. Saisir la quantité produite
5. Ajouter des notes si nécessaire
6. Enregistrer

### **Enregistrer un Mouvement de Stock**
1. Cliquer sur "Mouvement Stock"
2. Sélectionner le département et le produit
3. Choisir le type (Entrée ou Sortie)
4. Saisir la quantité
5. Enregistrer

### **Consulter les Totaux**
- **Vue d'ensemble** : Cartes des départements avec totaux
- **Productions récentes** : Liste des dernières productions
- **Mouvements de stock** : Historique des entrées/sorties

---

*Le système de gestion des productions et stocks par département est maintenant **opérationnel** et **intégré** !* 🎉

