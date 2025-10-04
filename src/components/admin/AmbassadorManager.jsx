import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  FaUserPlus,
  FaEdit,
  FaTrash,
  FaChartLine,
  FaMoneyBillWave,
  FaGift,
  FaUsers,
  FaSearch,
  FaFilter,
  FaDownload,
  FaCopy,
  FaEye,
  FaEyeSlash
} from 'react-icons/fa';
import {
  calculateAmbassadorStats,
  exportStatsToCSV,
  formatPoints,
  LOYALTY_CONFIG
} from '../../utils/loyaltyUtils';
import { formatPrice } from '../../utils/adminUtils';

const AmbassadorManager = ({ currentRestaurantId }) => {
  const [ambassadors, setAmbassadors] = useState([]);
  const [promoCodes, setPromoCodes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedAmbassador, setSelectedAmbassador] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    commissionRate: LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION,
    active: true
  });
  // Plus de sélection manuelle: on détecte automatiquement par email
  // Admin mode states
  const [restaurants, setRestaurants] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  // Load data
  useEffect(() => {
    // Admin mode: no currentRestaurantId => load all
    loadAmbassadors();
    loadPromoCodes();
    loadOrders();
    // Load restaurants for admin creation flow
    const fetchRestaurants = async () => {
      try {
        const snap = await getDocs(collection(db, 'restaurants'));
        setRestaurants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Failed to load restaurants', e);
      }
    };
    fetchRestaurants();
  }, [currentRestaurantId]);

  // Suppression du chargement de liste d'utilisateurs: détection à la volée par email

  const loadAmbassadors = () => {
    let qRef;
    if (currentRestaurantId) {
      qRef = query(collection(db, 'ambassadors'), where('managerId', '==', currentRestaurantId));
    } else {
      qRef = collection(db, 'ambassadors');
    }
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      const ambassadorsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAmbassadors(ambassadorsList);
      setLoading(false);
    });
    return unsubscribe;
  };

  const loadPromoCodes = () => {
    let qRef;
    if (currentRestaurantId) {
      qRef = query(collection(db, 'promoCodes'), where('managerId', '==', currentRestaurantId));
    } else {
      qRef = collection(db, 'promoCodes');
    }
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      const codesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromoCodes(codesList);
    });
    return unsubscribe;
  };

  const loadOrders = () => {
    // Load orders with promo codes
    let qRef;
    if (currentRestaurantId) {
      qRef = query(collection(db, 'orders'), where('restaurantId', '==', currentRestaurantId));
    } else {
      qRef = collection(db, 'orders');
    }
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      const ordersList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(order => order.promoCode);
      setOrders(ordersList);
    });
    return unsubscribe;
  };

  // Create new ambassador
  const createAmbassador = async () => {
    try {
      const managerIdToUse = currentRestaurantId || selectedManagerId;
      if (!managerIdToUse) {
        alert('Veuillez sélectionner un restaurant/manager pour cet ambassadeur.');
        return;
      }
      // 1) Tenter de trouver un utilisateur existant par email
      let linkedUser = null;
      if (formData.email && formData.email.trim()) {
        const qEmail = query(collection(db, 'usersrestau'), where('email', '==', formData.email.trim()));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          const d = snapEmail.docs[0];
          linkedUser = { id: d.id, ...d.data() };
        }
      }

      // 2) Empêcher les doublons: un userId ou email déjà ambassadeur
      if (linkedUser) {
        const qDupByUser = query(collection(db, 'ambassadors'), where('userId', '==', linkedUser.id));
        const dupUserSnap = await getDocs(qDupByUser);
        if (!dupUserSnap.empty) {
          alert('Ce compte est déjà ambassadeur.');
          return;
        }
      } else if (formData.email) {
        const qDupByEmail = query(collection(db, 'ambassadors'), where('email', '==', formData.email.trim()));
        const dupEmailSnap = await getDocs(qDupByEmail);
        if (!dupEmailSnap.empty) {
          alert("Cet email est déjà utilisé par un ambassadeur.");
          return;
        }
      }

      // 3) Construire les données ambassadeur
      let ambassadorData;
      if (linkedUser) {
        ambassadorData = {
          userId: linkedUser.id,
          managerId: managerIdToUse,
          name: linkedUser.firstName || linkedUser.lastName
            ? `${linkedUser.firstName || ''} ${linkedUser.lastName || ''}`.trim()
            : (linkedUser.name || formData.name),
          email: linkedUser.email || formData.email,
          phone: linkedUser.phone || formData.phone,
          commissionRate: Number(formData.commissionRate),
          active: formData.active,
          totalEarned: 0,
          totalOrders: 0,
          totalRevenue: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        // Mettre à jour le rôle utilisateur (optionnel)
        await updateDoc(doc(db, 'usersrestau', linkedUser.id), { role: 'ambassador', updatedAt: serverTimestamp() });
      } else {
        // 4) Aucun compte existant: on crée le compte Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        ambassadorData = {
          userId: userCredential.user.uid,
          managerId: managerIdToUse,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          commissionRate: Number(formData.commissionRate),
          active: formData.active,
          totalEarned: 0,
          totalOrders: 0,
          totalRevenue: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
      }

      const ambassadorRef = await addDoc(collection(db, 'ambassadors'), ambassadorData);

      // Générer et créer un code promo par défaut pour cet ambassadeur
      const baseName = (ambassadorData.name || ambassadorData.email || 'AMB').toString();
      const normalize = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9]/g, '');
      const base = normalize(baseName).toUpperCase();
      // Fonction pour générer un code unique de type NOMXYZ (NOM=3-6 lettres, XYZ=3 chiffres)
      const generateCandidate = () => {
        const head = base.substring(0, Math.min(6, Math.max(3, base.length)));
        const tail = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        return `${head}${tail}`;
      };
      let code = generateCandidate();
      // Vérifier l'unicité du code, réessayer si nécessaire
      for (let i = 0; i < 5; i++) {
        const qCode = query(collection(db, 'promoCodes'), where('code', '==', code));
        const snap = await getDocs(qCode);
        if (snap.empty) break;
        code = generateCandidate();
      }
      // Créer le document promoCodes
      await addDoc(collection(db, 'promoCodes'), {
        code,
        ambassadorId: ambassadorRef.id,
        managerId: managerIdToUse,
        active: true,
        discountType: 'percentage',
        discountValue: 5, // 5% par défaut (ajustable)
        pointsValue: 0, // bonus points optionnel
        maxUses: 0, // 0 = illimité
        usesCount: 0,
        createdAt: serverTimestamp(),
        lastUsed: null,
        expiration: null
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        commissionRate: LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION,
        active: true
      });
      // aucun état à nettoyer pour la sélection
      setShowCreateModal(false);
      
      alert('Ambassadeur créé avec succès, et code promo généré.');
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  // No manual search now; we propose a list directly

  // Update ambassador
  const updateAmbassador = async () => {
    if (!selectedAmbassador) return;

    try {
      await updateDoc(doc(db, 'ambassadors', selectedAmbassador.id), {
        name: formData.name,
        phone: formData.phone,
        commissionRate: Number(formData.commissionRate),
        active: formData.active,
        updatedAt: serverTimestamp()
      });

      setShowEditModal(false);
      setSelectedAmbassador(null);
      alert('Ambassadeur mis à jour avec succès!');
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  // Delete ambassador
  const deleteAmbassador = async (ambassadorId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet ambassadeur?')) return;

    try {
      // Deactivate related promo codes
      const codes = promoCodes.filter(code => code.ambassadorId === ambassadorId);
      for (const code of codes) {
        await updateDoc(doc(db, 'promoCodes', code.id), { active: false });
      }

      // Delete ambassador
      await deleteDoc(doc(db, 'ambassadors', ambassadorId));
      
      alert('Ambassadeur supprimé avec succès!');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  // Get ambassador stats
  const getAmbassadorStats = (ambassadorId) => {
    const ambassadorCodes = promoCodes.filter(code => code.ambassadorId === ambassadorId);
    const codeStrings = ambassadorCodes.map(c => c.code);
    const ambassadorOrders = orders.filter(order => codeStrings.includes(order.promoCode));
    
    if (ambassadorCodes.length > 0) {
      return calculateAmbassadorStats(ambassadorOrders, ambassadorCodes[0]);
    }
    
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalPoints: 0,
      totalCommission: 0,
      averageOrderValue: 0
    };
  };

  // Filter ambassadors
  const filteredAmbassadors = ambassadors.filter(ambassador => {
    const matchesSearch = ambassador.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ambassador.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                          (filterStatus === 'active' && ambassador.active) ||
                          (filterStatus === 'inactive' && !ambassador.active);
    return matchesSearch && matchesStatus;
  });

  // Export all stats
  const exportAllStats = () => {
    const data = filteredAmbassadors.map(ambassador => {
      const stats = getAmbassadorStats(ambassador.id);
      return {
        Nom: ambassador.name,
        Email: ambassador.email,
        Téléphone: ambassador.phone,
        'Taux commission': `${(ambassador.commissionRate * 100).toFixed(1)}%`,
        Statut: ambassador.active ? 'Actif' : 'Inactif',
        'Total commandes': stats.totalOrders,
        'Revenus générés': `${stats.totalRevenue} FCFA`,
        'Commission totale': `${stats.totalCommission} FCFA`,
        'Points distribués': stats.totalPoints
      };
    });

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ambassadeurs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Ambassadeurs</h2>
          <div className="flex space-x-3">
            <button
              onClick={exportAllStats}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center"
            >
              <FaDownload className="mr-2" />
              Exporter
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <FaUserPlus className="mr-2" />
              Nouvel Ambassadeur
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tous</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ambassadeurs</p>
              <p className="text-2xl font-bold">{ambassadors.length}</p>
            </div>
            <FaUsers className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Codes Actifs</p>
              <p className="text-2xl font-bold">
                {promoCodes.filter(c => c.active).length}
              </p>
            </div>
            <FaGift className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenus Totaux</p>
              <p className="text-xl font-bold">
                {formatPrice(orders.reduce((sum, o) => sum + (o.total || 0), 0))}
              </p>
            </div>
            <FaMoneyBillWave className="text-3xl text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Commissions Dues</p>
              <p className="text-xl font-bold">
                {formatPrice(
                  ambassadors.reduce((sum, a) => {
                    const stats = getAmbassadorStats(a.id);
                    return sum + stats.totalCommission;
                  }, 0)
                )}
              </p>
            </div>
            <FaChartLine className="text-3xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Ambassadors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ambassadeur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAmbassadors.map((ambassador) => {
              const stats = getAmbassadorStats(ambassador.id);
              const ambassadorCodes = promoCodes.filter(c => c.ambassadorId === ambassador.id);
              
              return (
                <tr key={ambassador.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ambassador.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ambassadorCodes.length} code(s)
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{ambassador.email}</div>
                    <div className="text-sm text-gray-500">{ambassador.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {(ambassador.commissionRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div>{stats.totalOrders} commandes</div>
                      <div className="text-gray-500">
                        {formatPrice(stats.totalRevenue)} générés
                      </div>
                      <div className="text-green-600 font-medium">
                        {formatPrice(stats.totalCommission)} commission
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      ambassador.active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {ambassador.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedAmbassador(ambassador);
                          setShowStatsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <FaChartLine />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAmbassador(ambassador);
                          setFormData({
                            name: ambassador.name,
                            email: ambassador.email,
                            phone: ambassador.phone,
                            commissionRate: ambassador.commissionRate,
                            active: ambassador.active
                          });
                          setShowEditModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => deleteAmbassador(ambassador.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold mb-4">Créer un Ambassadeur</h3>

              <div className="space-y-4">
                {!currentRestaurantId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant / Manager</label>
                    <select
                      value={selectedManagerId}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Sélectionner --</option>
                      {restaurants.map(r => (
                        <option key={r.id} value={r.id}>{r.name || r.id}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux de commission (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.commissionRate * 100}
                    onChange={(e) => setFormData({...formData, commissionRate: Number(e.target.value) / 100})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="active" className="text-sm text-gray-700">
                    Compte actif
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      name: '',
                      email: '',
                      password: '',
                      phone: '',
                      commissionRate: LOYALTY_CONFIG.DEFAULT_AMBASSADOR_COMMISSION,
                      active: true
                    });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={createAmbassador}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Créer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold mb-4">Modifier l'Ambassadeur</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email (non modifiable)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux de commission (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.commissionRate * 100}
                    onChange={(e) => setFormData({...formData, commissionRate: Number(e.target.value) / 100})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active-edit"
                    checked={formData.active}
                    onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="active-edit" className="text-sm text-gray-700">
                    Compte actif
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedAmbassador(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Annuler
                </button>
                <button
                  onClick={updateAmbassador}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Mettre à jour
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AmbassadorManager;
