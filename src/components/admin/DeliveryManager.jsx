import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  FaTruck,
  FaPlus,
  FaEdit,
  FaTrash,
  FaPhone,
  FaUser,
  FaMotorcycle,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaSearch,
  FaDownload,
  FaExternalLinkAlt,
  FaSyncAlt,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import InitializeDeliverers from './InitializeDeliverers';
import MotorcyclesManager from './MotorcyclesManager';

const DeliveryManager = ({ currentRestaurantId, userRole }) => {
  const [deliverers, setDeliverers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showMotorcyclesManager, setShowMotorcyclesManager] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'active', 'inactive'
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [delivererForm, setDelivererForm] = useState({
    name: '',
    phone: '',
    email: '',
    vehicleType: 'moto',
    vehicleNumber: '',
    zone: '',
    active: true
  });

  const VEHICLE_TYPES = [
    { value: 'moto', label: '🏍️ Moto', icon: '🏍️' },
    { value: 'car', label: '🚗 Voiture', icon: '🚗' },
    { value: 'bicycle', label: '🚲 Vélo', icon: '🚲' },
    { value: 'scooter', label: '🛵 Scooter', icon: '🛵' }
  ];

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const deliverersSnap = await getDocs(
        query(
          collection(db, 'deliverers'),
          where('restaurantId', '==', currentRestaurantId)
        )
      );

      // Trier côté client pour éviter l'index composite
      const deliverersData = deliverersSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      setDeliverers(deliverersData);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  const handleCreateDeliverer = async () => {
    try {
      const newErrors = {};
      if (!delivererForm.name.trim()) newErrors.name = true;
      if (!delivererForm.phone.trim()) newErrors.phone = true;
      if (!delivererForm.vehicleType) newErrors.vehicleType = true;

      setErrors(newErrors);
      if (Object.keys(newErrors).length) {
        toast.error('Veuillez remplir tous les champs requis');
        return;
      }

      setIsSubmitting(true);
      if (selectedDeliverer) {
        await updateDeliverer();
      } else {
        await createDeliverer();
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createDeliverer = async () => {
    await addDoc(collection(db, 'deliverers'), {
      ...delivererForm,
      restaurantId: currentRestaurantId,
      createdAt: serverTimestamp(),
      totalDeliveries: 0,
      rating: 0,
      earnings: 0
    });
    toast.success('Livreur créé avec succès');
    resetForm();
    loadData();
  };

  const updateDeliverer = async () => {
    await updateDoc(doc(db, 'deliverers', selectedDeliverer.id), {
      ...delivererForm,
      updatedAt: serverTimestamp()
    });
    toast.success('Livreur modifié avec succès');
    resetForm();
    loadData();
  };

  const handleEditDeliverer = (deliverer) => {
    setSelectedDeliverer(deliverer);
    setDelivererForm({
      name: deliverer.name,
      phone: deliverer.phone,
      email: deliverer.email || '',
      vehicleType: deliverer.vehicleType,
      vehicleNumber: deliverer.vehicleNumber || '',
      zone: deliverer.zone || '',
      active: deliverer.active
    });
    setShowModal(true);
  };

  const handleDeleteDeliverer = async (delivererId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce livreur ?')) return;
    
    try {
      await deleteDoc(doc(db, 'deliverers', delivererId));
      toast.success('Livreur supprimé avec succès');
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleDelivererStatus = async (deliverer) => {
    try {
      await updateDoc(doc(db, 'deliverers', deliverer.id), {
        active: !deliverer.active,
        updatedAt: serverTimestamp()
      });
      toast.success(`Livreur ${!deliverer.active ? 'activé' : 'désactivé'} avec succès`);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la modification du statut');
    }
  };

  const recalculateStats = async () => {
    if (!window.confirm('Recalculer les statistiques de tous les livreurs ? Cela peut prendre quelques secondes.')) {
      return;
    }

    try {
      toast.info('Recalcul en cours...');
      
      // Récupérer toutes les commandes livrées
      const ordersQuery = query(
        collection(db, 'orders'),
        where('restaurantId', '==', currentRestaurantId),
        where('status', 'in', ['livree', 'delivered'])
      );
      const ordersSnap = await getDocs(ordersQuery);
      
      // Calculer les stats par livreur
      const statsPerDeliverer = {};
      ordersSnap.docs.forEach(orderDoc => {
        const order = orderDoc.data();
        const delivererName = order.assignedDeliverer;
        
        if (delivererName && delivererName !== 'Non assigné' && delivererName.trim() !== '') {
          if (!statsPerDeliverer[delivererName]) {
            statsPerDeliverer[delivererName] = {
              totalDeliveries: 0,
              earnings: 0
            };
          }
          statsPerDeliverer[delivererName].totalDeliveries += 1;
          statsPerDeliverer[delivererName].earnings += (order.deliveryFee || 0);
        }
      });
      
      // Mettre à jour chaque livreur
      const batch = writeBatch(db);
      for (const deliverer of deliverers) {
        const stats = statsPerDeliverer[deliverer.name] || { totalDeliveries: 0, earnings: 0 };
        const delivererRef = doc(db, 'deliverers', deliverer.id);
        batch.update(delivererRef, {
          totalDeliveries: stats.totalDeliveries,
          earnings: stats.earnings
        });
      }
      
      await batch.commit();
      await loadData(); // Recharger la liste
      
      toast.success('Statistiques recalculées avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du recalcul');
    }
  };

  const resetForm = () => {
    setDelivererForm({
      name: '',
      phone: '',
      email: '',
      vehicleType: 'moto',
      vehicleNumber: '',
      zone: '',
      active: true
    });
    setSelectedDeliverer(null);
    setShowModal(false);
    setErrors({});
  };

  // Filtrage des livreurs
  const filteredDeliverers = deliverers.filter(deliverer => {
    const matchesSearch = deliverer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deliverer.phone.includes(searchTerm) ||
                         deliverer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && deliverer.active) ||
                         (filterStatus === 'inactive' && !deliverer.active);
    
    return matchesSearch && matchesStatus;
  });

  // Statistiques
  const stats = {
    total: deliverers.length,
    active: deliverers.filter(d => d.active).length,
    inactive: deliverers.filter(d => !d.active).length,
    totalDeliveries: deliverers.reduce((sum, d) => sum + (d.totalDeliveries || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header avec statistiques */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4 md:gap-4">
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 sm:text-sm">Total Livreurs</p>
              <p className="text-lg font-bold text-gray-900 sm:text-xl md:text-2xl">{stats.total}</p>
            </div>
            <FaTruck className="text-xl text-blue-500 sm:text-2xl md:text-3xl" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 sm:text-sm">Actifs</p>
              <p className="text-lg font-bold text-green-600 sm:text-xl md:text-2xl">{stats.active}</p>
            </div>
            <FaCheckCircle className="text-xl text-green-500 sm:text-2xl md:text-3xl" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 sm:text-sm">Inactifs</p>
              <p className="text-lg font-bold text-red-600 sm:text-xl md:text-2xl">{stats.inactive}</p>
            </div>
            <FaTimesCircle className="text-xl text-red-500 sm:text-2xl md:text-3xl" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-2 sm:p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 sm:text-sm">Livraisons Total</p>
              <p className="text-lg font-bold text-purple-600 sm:text-xl md:text-2xl">{stats.totalDeliveries}</p>
            </div>
            <FaMapMarkerAlt className="text-xl text-purple-500 sm:text-2xl md:text-3xl" />
          </div>
        </div>
      </div>

      {/* Actions et filtres */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 transition duration-200 flex items-center justify-center sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
            >
              <FaPlus className="mr-1 text-xs sm:mr-2 sm:text-sm" /> Nouveau Livreur
            </button>
            <button
              onClick={() => setShowMotorcyclesManager(true)}
              className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 transition duration-200 flex items-center justify-center sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
            >
              <FaMotorcycle className="mr-1 text-xs sm:mr-2 sm:text-sm" /> Ajouter une moto
            </button>
            
            {deliverers.length === 0 && (
              <button
                onClick={() => setShowInitModal(true)}
                className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition duration-200 flex items-center justify-center sm:w-auto sm:px-4 sm:py-2 sm:text-sm"
              >
                <FaDownload className="mr-1 text-xs sm:mr-2 sm:text-sm" /> Initialiser les livreurs
              </button>
            )}
            
            <a
              href="/login-livreur"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition duration-200 flex items-center justify-center"
            >
              <FaExternalLinkAlt className="mr-2" /> Interface Livreur
            </a>
            
            <button
              onClick={recalculateStats}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200 flex items-center justify-center"
            >
              <FaSyncAlt className="mr-2" /> Recalculer Stats
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 flex-1 md:max-w-2xl">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs uniquement</option>
              <option value="inactive">Inactifs uniquement</option>
            </select>
          </div>
        </div>

          {/* Panel pour gérer les motos séparément */}
          {showMotorcyclesManager && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">Gestion des motos</h4>
                <button className="text-sm text-gray-600" onClick={() => setShowMotorcyclesManager(false)}>Fermer</button>
              </div>
              <MotorcyclesManager currentRestaurantId={currentRestaurantId} />
            </div>
          )}
      </div>

      {/* Liste des livreurs */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-800">
            Livreurs ({filteredDeliverers.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livreur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livraisons</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDeliverers.map((deliverer) => (
                <tr key={deliverer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <FaUser className="text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{deliverer.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <div className="flex items-center text-gray-900">
                        <FaPhone className="mr-2 text-gray-400" />
                        {deliverer.phone}
                      </div>
                      {deliverer.email && (
                        <div className="text-gray-500 mt-1">{deliverer.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {VEHICLE_TYPES.find(v => v.value === deliverer.vehicleType)?.icon || '🚗'} {VEHICLE_TYPES.find(v => v.value === deliverer.vehicleType)?.label.split(' ')[1] || deliverer.vehicleType}
                      </span>
                      {deliverer.vehicleNumber && (
                        <div className="text-gray-500 mt-1 text-xs">{deliverer.vehicleNumber}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {deliverer.zone || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleDelivererStatus(deliverer)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        deliverer.active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {deliverer.active ? '✓ Actif' : '✗ Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {deliverer.totalDeliveries || 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditDeliverer(deliverer)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FaEdit />
                      </button>
                      {userRole === 'manager' && (
                        <button
                          onClick={() => handleDeleteDeliverer(deliverer.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredDeliverers.length === 0 && (
            <div className="text-center py-8">
              <FaTruck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucun livreur trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Création/Édition */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  {selectedDeliverer ? 'Modifier le livreur' : 'Nouveau livreur'}
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nom complet *
                      </label>
                      <input
                        type="text"
                        value={delivererForm.name}
                        onChange={(e) => setDelivererForm({ ...delivererForm, name: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Ex: Jean Dupont"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        value={delivererForm.phone}
                        onChange={(e) => setDelivererForm({ ...delivererForm, phone: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.phone ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Ex: +237 6XX XX XX XX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={delivererForm.email}
                      onChange={(e) => setDelivererForm({ ...delivererForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type de véhicule *
                      </label>
                      <select
                        value={delivererForm.vehicleType}
                        onChange={(e) => setDelivererForm({ ...delivererForm, vehicleType: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          errors.vehicleType ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        {VEHICLE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Numéro d'immatriculation
                      </label>
                      <input
                        type="text"
                        value={delivererForm.vehicleNumber}
                        onChange={(e) => setDelivererForm({ ...delivererForm, vehicleNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: AB-123-CD"
                      />
                    </div>
                  </div>

                  {/* Marque et Date d'achat gérées séparément dans la section Motos */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zone de livraison
                    </label>
                    <input
                      type="text"
                      value={delivererForm.zone}
                      onChange={(e) => setDelivererForm({ ...delivererForm, zone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: Centre-ville, Akwa, Bonanjo..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="active"
                      checked={delivererForm.active}
                      onChange={(e) => setDelivererForm({ ...delivererForm, active: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                      Livreur actif
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition duration-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleCreateDeliverer}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enregistrement...' : (selectedDeliverer ? 'Modifier' : 'Créer')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal d'initialisation des livreurs */}
      {showInitModal && (
        <InitializeDeliverers
          restaurantId={currentRestaurantId}
          onClose={() => {
            setShowInitModal(false);
            loadData(); // Recharger la liste après initialisation
          }}
        />
      )}
    </div>
  );
};

export default DeliveryManager;
