# 🏗️ Système de Classification des Sorties

## 📋 Vue d'ensemble

Le système de classification des sorties organise toutes les dépenses du projet en **4 départements cohérents** sans doublons, permettant une gestion financière précise et transparente.

## 🏢 Les 4 Départements

### 1. 🍽️ **Maged'Abord** (Restaurant Principal)
- **Couleur** : Rouge (#EF4444)
- **Description** : Plats traditionnels et cuisine principale
- **Catégories** : Ingrédients, Équipement, Services publics, Personnel, Marketing, Loyer, Assurances

### 2. 🥪 **Crunch** (Restaurant Secondaire)
- **Couleur** : Orange (#F59E0B)
- **Description** : Snacks, boissons et restauration rapide
- **Catégories** : Ingrédients, Équipement, Services publics, Personnel, Marketing, Loyer, Assurances

### 3. 🏪 **Square** (Service de Livraison)
- **Couleur** : Violet (#8B5CF6)
- **Description** : Logistique et service de livraison
- **Catégories** : Livraison, Équipement, Personnel, Loyer, Assurances

### 4. 📦 **Divers** (Administratif)
- **Couleur** : Gris (#6B7280)
- **Description** : Dépenses générales et administratives
- **Catégories** : Services publics, Marketing, Assurances, Autres

## 🏷️ Catégories de Dépenses

| Catégorie | Icône | Description | Départements |
|-----------|-------|-------------|--------------|
| 🥬 Ingrédients | | Achats d'ingrédients et matières premières | Maged'Abord, Crunch |
| 🔧 Équipement | | Achat et maintenance d'équipements | Maged'Abord, Crunch, Square |
| ⚡ Services publics | | Électricité, eau, gaz, internet | Maged'Abord, Crunch, Divers |
| 🚚 Livraison | | Carburant, entretien véhicules, frais de livraison | Square |
| 👥 Personnel | | Salaires, primes, formations | Maged'Abord, Crunch, Square |
| 📢 Marketing | | Publicité, promotions, communication | Maged'Abord, Crunch, Divers |
| 🏠 Loyer | | Loyers des locaux | Maged'Abord, Crunch, Square |
| 🛡️ Assurances | | Assurances diverses | Tous |
| 📋 Autres | | Dépenses diverses non classées | Divers |

## 🛠️ Composants Implémentés

### 1. **ExpenseClassificationSystem.jsx**
- Interface de visualisation et modification des classifications
- Filtrage par période et département
- Statistiques en temps réel
- Export CSV des données

### 2. **ExpenseCleanupManager.jsx**
- Nettoyage automatique des données existantes
- Détection des doublons
- Rapport de cohérence
- Classification automatique intelligente

### 3. **expenseCleanup.js** (Utilitaires)
- Fonctions de classification automatique
- Détection de doublons
- Génération de rapports
- Nettoyage en lot

## 🎯 Fonctionnalités Clés

### ✅ **Classification Automatique**
- Analyse intelligente des descriptions et fournisseurs
- Classification basée sur les mots-clés
- Fallback vers classification manuelle

### ✅ **Détection de Doublons**
- Comparaison par description, montant et date
- Identification des doublons potentiels
- Interface de révision

### ✅ **Rapports de Cohérence**
- Vue d'ensemble des dépenses par département
- Répartition par catégorie
- Identification des non-classifiés
- Statistiques de qualité des données

### ✅ **Interface Utilisateur**
- Design moderne et intuitif
- Filtres avancés
- Export de données
- Gestion des permissions par rôle

## 🔐 Permissions par Rôle

### **Manager** 👨‍💼
- Accès complet à tous les départements
- Peut modifier les classifications
- Peut lancer le nettoyage automatique

### **Accountant** 👩‍💼
- Accès en lecture/écriture
- Peut modifier les classifications
- Peut lancer le nettoyage automatique

### **Autres Rôles** 👤
- Accès en lecture seule
- Peut consulter les rapports

## 📊 Avantages du Système

### 🎯 **Cohérence Financière**
- Élimination des doublons
- Classification uniforme
- Traçabilité complète

### 📈 **Analyse Précise**
- Répartition claire par département
- Suivi des coûts par catégorie
- Rapports détaillés

### ⚡ **Efficacité Opérationnelle**
- Classification automatique
- Interface intuitive
- Export de données

### 🔍 **Transparence**
- Visibilité sur toutes les sorties
- Détection des anomalies
- Rapports de qualité

## 🚀 Utilisation

1. **Accéder** à "Classification des Sorties" dans le menu admin
2. **Visualiser** les dépenses classifiées par département
3. **Modifier** les classifications si nécessaire
4. **Utiliser** "Nettoyage des Dépenses" pour automatiser
5. **Exporter** les rapports pour analyse externe

## 📈 Métriques de Succès

- **0 doublon** dans les données
- **100% des dépenses** classifiées
- **Cohérence** entre tous les départements
- **Traçabilité** complète des modifications

---

*Ce système garantit une gestion financière transparente et cohérente pour tous les départements du projet.*



