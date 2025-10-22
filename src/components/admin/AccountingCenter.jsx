import React, { useState, Suspense, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import AccountingReports from './AccountingReports';
import ExpensesManager from './ExpensesManager';
import BudgetManager from './BudgetManager';

const tabs = [
  { id: 'entries', label: 'Entrées' },
  { id: 'expenses', label: 'Dépenses' },
  { id: 'budgets', label: 'Budgets' }
];

const AccountingCenter = ({ orders = [], items = [], extraLists = [], userRole, currentRestaurantId }) => {
  const [activeTab, setActiveTab] = useState('entries');
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [loading, setLoading] = useState(false);

  // Charger les données nécessaires pour les budgets
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Charger les menus
        const menusQuery = query(collection(db, 'menus'), orderBy('name'));
        const menusSnap = await getDocs(menusQuery);
        const menusData = menusSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMenus(menusData);

        // Charger les catégories
        const categoriesQuery = query(collection(db, 'categories'), orderBy('name'));
        const categoriesSnap = await getDocs(categoriesQuery);
        const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCategories(categoriesData);

        // Charger les listes d'achats
        const purchasesQuery = query(
          collection(db, 'purchaseLists'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('date', 'desc')
        );
        const purchasesSnap = await getDocs(purchasesQuery);
        const purchasesData = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPurchaseLists(purchasesData);

      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentRestaurantId) {
      loadData();
    }
  }, [currentRestaurantId]);

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b px-4 sm:px-6 pt-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">Centre Comptable</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Vue unifiée des entrées, dépenses et budgets</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-md text-sm sm:text-base border transition-colors ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'entries' && (
            <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
              <AccountingReports orders={orders} items={items} extraLists={extraLists} userRole={userRole} />
            </Suspense>
          )}

          {activeTab === 'expenses' && (
            <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
              <ExpensesManager currentRestaurantId={currentRestaurantId} userRole={userRole} />
            </Suspense>
          )}

          {activeTab === 'budgets' && (
            <Suspense fallback={<div className="text-center py-8">Chargement...</div>}>
              <BudgetManager 
                orders={orders} 
                userRole={userRole} 
                menus={menus} 
                categories={categories} 
                items={items}
                purchaseLists={purchaseLists}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountingCenter;


