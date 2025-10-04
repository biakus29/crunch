import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import {
  FaClipboardList,
  FaPlus,
  FaEdit,
  FaEye,
  FaCalculator,
  FaExclamationTriangle
} from 'react-icons/fa';

const InventoryManager = ({ currentRestaurantId }) => {
  const [inventories, setInventories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [purchaseLists, setPurchaseLists] = useState([]);
  const [currentInventory, setCurrentInventory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [inventoryForm, setInventoryForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'draft'
  });

  useEffect(() => {
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      const [inventoriesSnap, ingredientsSnap, purchasesSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'inventories'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('createdAt', 'desc')
        )),
        getDocs(query(
          collection(db, 'ingredients'),
          where('restaurantId', '==', currentRestaurantId),
          orderBy('name')
        )),
        getDocs(query(
          collection(db, 'purchaseLists'),
          where('restaurantId', '==', currentRestaurantId),
          where('status', '==', 'approved')
        ))
      ]);

      setInventories(inventoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIngredients(ingredientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPurchaseLists(purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      setLoading(false);
    }
  };

  const calculateTheoreticalStock = (ingredientId, startDate, endDate) => {
    // Stock initial (stock final de la période précédente)
    const previousInventory = inventories.find(inv => 
      new Date(inv.endDate) < new Date(startDate) && inv.status === 'completed'
    );
    const initialStock = previousInventory?.items?.find(item => item.ingredientId === ingredientId)?.realQuantity || 0;

    // Approvisionnements de la période
    const periodPurchases = purchaseLists.filter(purchase => {
      const purchaseDate = new Date(purchase.date);
      return purchaseDate >= new Date(startDate) && purchaseDate <= new Date(endDate);
    });

    const totalPurchased = periodPurchases.reduce((total, purchase) => {
      const item = purchase.items?.find(item => item.ingredientId === ingredientId);
      return total + (item?.quantity || 0);
    }, 0);

    // Sorties (consommation) - à calculer depuis les productions
    const totalUsed = 0; // TODO: Calculer depuis les productions

    return {
      initialStock,
      purchased: totalPurchased,
      used: totalUsed,
      theoretical: initialStock + totalPurchased - totalUsed
    };
  };

  const createInventory = async () => {
    try {
      const inventoryItems = ingredients.map(ingredient => {
        const theoretical = calculateTheoreticalStock(
          ingredient.id,
          inventoryForm.startDate,
          inventoryForm.endDate
        );

        return {
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          unit: ingredient.units?.[0]?.name || 'kg',
          initialStock: theoretical.initialStock,
          purchased: theoretical.purchased,
          used: theoretical.used,
          theoretical: theoretical.theoretical,
          realQuantity: 0,
          variance: 0,
          comment: ''
        };
      });

      const inventoryData = {
        ...inventoryForm,
        restaurantId: currentRestaurantId,
        items: inventoryItems,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, 'inventories'), inventoryData);
      setInventories(prev => [{ id: ref.id, ...inventoryData }, ...prev]);
      setShowCreateModal(false);
      setInventoryForm({ name: '', startDate: '', endDate: '', status: 'draft' });
    } catch (error) {
      console.error('Erreur création inventaire:', error);
      alert('Erreur lors de la création de l\'inventaire');
    }
  };

  const updateInventoryItem = async (inventoryId, itemIndex, field, value) => {
    try {
      const inventory = inventories.find(inv => inv.id === inventoryId);
      const updatedItems = [...inventory.items];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        [field]: value
      };

      // Recalculer l'écart si on modifie la quantité réelle
      if (field === 'realQuantity') {
        updatedItems[itemIndex].variance = value - updatedItems[itemIndex].theoretical;
      }

      await updateDoc(doc(db, 'inventories', inventoryId), {
        items: updatedItems,
        updatedAt: serverTimestamp()
      });

      setInventories(prev => prev.map(inv => 
        inv.id === inventoryId ? { ...inv, items: updatedItems } : inv
      ));
    } catch (error) {
      console.error('Erreur mise à jour inventaire:', error);
    }
  };

  const completeInventory = async (inventoryId) => {
    try {
      await updateDoc(doc(db, 'inventories', inventoryId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setInventories(prev => prev.map(inv => 
        inv.id === inventoryId ? { ...inv, status: 'completed' } : inv
      ));
    } catch (error) {
      console.error('Erreur finalisation inventaire:', error);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <div className="flex flex-col justify-between items-start gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">Inventaires & Stocks</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition duration-200 sm:w-auto sm:px-4 sm:py-2 sm:text-sm flex items-center justify-center gap-1 sm:gap-2"
        >
          <FaPlus className="text-xs sm:text-sm" /> Nouvel Inventaire
        </button>
      </div>

      {/* Liste des inventaires */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-3 border-b sm:p-4 md:p-6">
          <h4 className="font-semibold text-base text-gray-800 sm:text-lg md:text-xl">Inventaires</h4>
        </div>
        {/* Desktop/Tablets */}
        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Nom</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Période</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Statut</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Écarts</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700 sm:px-4 sm:py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {inventories.map(inventory => {
                const totalVariance = inventory.items?.reduce((sum, item) => sum + Math.abs(item.variance || 0), 0) || 0;
                const hasVariances = totalVariance > 0;

                return (
                  <tr key={inventory.id}>
                    <td className="px-3 py-2 font-semibold text-gray-800 sm:px-4 sm:py-3">{inventory.name}</td>
                    <td className="px-3 py-2 text-gray-700 sm:px-4 sm:py-3">{inventory.startDate} → {inventory.endDate}</td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium sm:px-3 sm:py-1.5 sm:text-sm ${
                        inventory.status === 'completed' ? 'bg-green-100 text-green-800' :
                        inventory.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {inventory.status === 'completed' ? 'Terminé' : inventory.status === 'draft' ? 'Brouillon' : inventory.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 sm:px-4 sm:py-3">
                      {hasVariances && (
                        <span className="flex items-center text-orange-600 text-sm">
                          <FaExclamationTriangle className="mr-1 text-xs" />
                          {totalVariance.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 space-x-1 sm:px-4 sm:py-3 sm:space-x-2">
                      <button onClick={() => setCurrentInventory(inventory)} className="text-blue-600 hover:text-blue-800 text-base sm:text-lg"><FaEye /></button>
                      {inventory.status === 'draft' && (
                        <>
                          <button onClick={() => setCurrentInventory(inventory)} className="text-green-600 hover:text-green-800 text-base sm:text-lg"><FaEdit /></button>
                          <button onClick={() => completeInventory(inventory.id)} className="text-purple-600 hover:text-purple-800 text-base sm:text-lg"><FaCalculator /></button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile: Cards */}
        <div className="md:hidden p-2 space-y-2 sm:p-3 sm:space-y-3">
          {inventories.map(inventory => {
            const totalVariance = inventory.items?.reduce((sum, item) => sum + Math.abs(item.variance || 0), 0) || 0;
            const hasVariances = totalVariance > 0;
            return (
              <div key={inventory.id} className="border rounded-lg p-2 sm:p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-sm text-gray-800 truncate sm:text-base">{inventory.name}</h5>
                    <p className="text-xs text-gray-600 mt-0.5 sm:text-sm">{inventory.startDate} → {inventory.endDate}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap sm:px-2 sm:py-1 sm:text-xs ${
                    inventory.status === 'completed' ? 'bg-green-100 text-green-800' :
                    inventory.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {inventory.status === 'completed' ? 'Terminé' : inventory.status === 'draft' ? 'Brouillon' : inventory.status}
                  </span>
                </div>
                {hasVariances && (
                  <div className="mt-1 text-xs text-orange-600 flex items-center sm:mt-2 sm:text-sm">
                    <FaExclamationTriangle className="mr-1 text-[10px] sm:text-xs" /> Écarts: {totalVariance.toFixed(1)}
                  </div>
                )}
                <div className="flex justify-end items-center space-x-2 text-base mt-2 sm:space-x-3 sm:text-lg sm:mt-3">
                  <button onClick={() => setCurrentInventory(inventory)} className="text-blue-600 hover:text-blue-800" aria-label="Voir"><FaEye /></button>
                  {inventory.status === 'draft' && (
                    <>
                      <button onClick={() => setCurrentInventory(inventory)} className="text-green-600 hover:text-green-800" aria-label="Modifier"><FaEdit /></button>
                      <button onClick={() => completeInventory(inventory.id)} className="text-purple-600" aria-label="Calculer"><FaCalculator /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Détail inventaire */}
      {currentInventory && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow"
        >
          <div className="p-4 border-b flex justify-between items-center">
            <h4 className="font-semibold">{currentInventory.name}</h4>
            <button
              onClick={() => setCurrentInventory(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          {/* Desktop/Tablets */}
          <div className="overflow-x-auto hidden md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Ingrédient</th>
                  <th className="px-3 py-2 text-left">Stock Initial</th>
                  <th className="px-3 py-2 text-left">Approvisionné</th>
                  <th className="px-3 py-2 text-left">Consommé</th>
                  <th className="px-3 py-2 text-left">Théorique</th>
                  <th className="px-3 py-2 text-left">Réel</th>
                  <th className="px-3 py-2 text-left">Écart</th>
                  <th className="px-3 py-2 text-left">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentInventory.items?.map((item, index) => (
                  <tr key={item.ingredientId} className={item.variance !== 0 ? 'bg-orange-50' : ''}>
                    <td className="px-3 py-2 font-medium">{item.ingredientName}</td>
                    <td className="px-3 py-2">{item.initialStock} {item.unit}</td>
                    <td className="px-3 py-2 text-green-600">+{item.purchased} {item.unit}</td>
                    <td className="px-3 py-2 text-red-600">-{item.used} {item.unit}</td>
                    <td className="px-3 py-2 font-semibold">{item.theoretical} {item.unit}</td>
                    <td className="px-3 py-2">
                      {currentInventory.status === 'draft' ? (
                        <input type="number" value={item.realQuantity} onChange={(e) => updateInventoryItem(currentInventory.id, index, 'realQuantity', Number(e.target.value))} className="w-20 px-2 py-1 border rounded" step="0.1" />
                      ) : (
                        <span>{item.realQuantity} {item.unit}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                    </td>
                    <td className="px-3 py-2">
                      {currentInventory.status === 'draft' ? (
                        <input type="text" value={item.comment} onChange={(e) => updateInventoryItem(currentInventory.id, index, 'comment', e.target.value)} className="w-32 px-2 py-1 border rounded text-xs" placeholder="Commentaire..." />
                      ) : (
                        <span className="text-xs">{item.comment}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile: Cards */}
          <div className="md:hidden p-3 space-y-3">
            {currentInventory.items?.map((item, index) => (
              <div key={item.ingredientId} className={`border rounded-lg p-3 ${item.variance !== 0 ? 'bg-orange-50' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-semibold text-sm">{item.ingredientName}</h5>
                    <p className="text-xs text-gray-500">Théorique: {item.theoretical} {item.unit}</p>
                  </div>
                  <div className={`text-xs font-semibold ${item.variance > 0 ? 'text-green-600' : item.variance < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>Initial: <span className="font-medium">{item.initialStock}</span></div>
                  <div>Appro: <span className="font-medium">+{item.purchased}</span></div>
                  <div>Consommé: <span className="font-medium">-{item.used}</span></div>
                  <div>Unité: <span className="font-medium">{item.unit}</span></div>
                </div>
                <div className="mt-2">
                  {currentInventory.status === 'draft' ? (
                    <div className="flex items-center space-x-2">
                      <input type="number" value={item.realQuantity} onChange={(e) => updateInventoryItem(currentInventory.id, index, 'realQuantity', Number(e.target.value))} className="w-24 px-2 py-1 border rounded text-sm" step="0.1" />
                      <input type="text" value={item.comment} onChange={(e) => updateInventoryItem(currentInventory.id, index, 'comment', e.target.value)} className="flex-1 px-2 py-1 border rounded text-sm" placeholder="Commentaire..." />
                    </div>
                  ) : (
                    <p className="text-sm">Réel: <span className="font-medium">{item.realQuantity} {item.unit}</span>{item.comment ? ` — ${item.comment}` : ''}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Modal création inventaire */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold mb-4">Nouvel Inventaire</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom de l'inventaire</label>
                <input
                  type="text"
                  value={inventoryForm.name}
                  onChange={(e) => setInventoryForm({...inventoryForm, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Ex: Inventaire Janvier 2024"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date début</label>
                  <input
                    type="date"
                    value={inventoryForm.startDate}
                    onChange={(e) => setInventoryForm({...inventoryForm, startDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date fin</label>
                  <input
                    type="date"
                    value={inventoryForm.endDate}
                    onChange={(e) => setInventoryForm({...inventoryForm, endDate: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={createInventory}
                disabled={!inventoryForm.name || !inventoryForm.startDate || !inventoryForm.endDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default InventoryManager;
