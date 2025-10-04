import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { 
  FaUserTie, 
  FaEdit, 
  FaSearch,
  FaUsers,
  FaCalculator,
  FaUtensils,
  FaShoppingCart,
  FaBox,
  FaTruck,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaInfoCircle
} from 'react-icons/fa';
import { ROLES, ROLE_LABELS } from '../../utils/rolePermissions';

const UserRoleManager = ({ currentRestaurantId }) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [updating, setUpdating] = useState(false);

  // Charger tous les utilisateurs
  useEffect(() => {
    loadUsers();
  }, []);

  // Filtrer les utilisateurs selon la recherche
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Charger tous les utilisateurs de tous les rôles
      const usersQuery = query(
        collection(db, 'usersrestau'),
        orderBy('createdAt', 'desc')
      );
      const usersSnap = await getDocs(usersQuery);
      const usersData = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUsers(usersData);
      setFilteredUsers(usersData);
      
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      alert('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setSelectedUser(null);
    setNewRole('');
  };

  const updateUserRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      setUpdating(true);

      await updateDoc(doc(db, 'usersrestau', selectedUser.id), {
        role: newRole,
        updatedAt: serverTimestamp()
      });

      // Mettre à jour la liste locale
      setUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, role: newRole }
          : user
      ));

      alert(`✅ Rôle modifié avec succès !\n\n${selectedUser.name} est maintenant ${ROLE_LABELS[newRole]}`);
      closeRoleModal();
      
    } catch (error) {
      console.error('Erreur lors de la modification du rôle:', error);
      alert('❌ Erreur lors de la modification du rôle');
    } finally {
      setUpdating(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case ROLES.MANAGER:
        return <FaUserTie className="text-blue-600" />;
      case ROLES.ACCOUNTANT:
        return <FaCalculator className="text-green-600" />;
      case ROLES.KITCHEN_SUPPLY:
        return <FaUtensils className="text-orange-600" />;
      case ROLES.ORDER_MANAGER:
        return <FaShoppingCart className="text-purple-600" />;
      case ROLES.SUPPLY_MANAGER:
        return <FaBox className="text-indigo-600" />;
      case ROLES.DELIVERY_MANAGER:
        return <FaTruck className="text-red-600" />;
      default:
        return <FaUsers className="text-gray-600" />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case ROLES.MANAGER:
        return 'bg-blue-100 text-blue-800';
      case ROLES.ACCOUNTANT:
        return 'bg-green-100 text-green-800';
      case ROLES.KITCHEN_SUPPLY:
        return 'bg-orange-100 text-orange-800';
      case ROLES.ORDER_MANAGER:
        return 'bg-purple-100 text-purple-800';
      case ROLES.SUPPLY_MANAGER:
        return 'bg-indigo-100 text-indigo-800';
      case ROLES.DELIVERY_MANAGER:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">👥 Gestion des Rôles Utilisateurs</h2>
            <p className="text-gray-600 mt-1">Modifier les rôles des utilisateurs existants</p>
          </div>
          <div className="text-sm text-gray-500">
            {users.length} utilisateur{users.length > 1 ? 's' : ''} au total
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email ou téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            Utilisateurs ({filteredUsers.length})
          </h3>
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <FaUsers className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur enregistré'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <div key={user.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getRoleIcon(user.role)}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800">
                        {user.name || 'Nom non défini'}
                      </h4>
                      <p className="text-gray-600">{user.email}</p>
                      {user.phone && (
                        <p className="text-sm text-gray-500">{user.phone}</p>
                      )}
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                        {user.active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            Inactif
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => openRoleModal(user)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaEdit />
                    <span>Modifier le rôle</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de modification de rôle */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <h3 className="text-xl font-semibold text-gray-800">
                Modifier le rôle de {selectedUser.name}
              </h3>
              <p className="text-gray-600 mt-1">
                Sélectionnez le nouveau rôle pour cet utilisateur
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rôle actuel
                  </label>
                  <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg">
                    {getRoleIcon(selectedUser.role)}
                    <span className="font-medium">{ROLE_LABELS[selectedUser.role]}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau rôle
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="">Sélectionner un rôle...</option>
                    {Object.entries(ROLES).map(([key, value]) => (
                      <option key={key} value={value}>
                        {ROLE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                
                {newRole && newRole !== selectedUser.role && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <FaInfoCircle className="text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium">Changement de rôle</p>
                        <p className="mt-1">
                          {selectedUser.name} passera de <strong>{ROLE_LABELS[selectedUser.role]}</strong> à <strong>{ROLE_LABELS[newRole]}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={closeRoleModal}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={updating}
              >
                Annuler
              </button>
              <button
                onClick={updateUserRole}
                disabled={!newRole || newRole === selectedUser.role || updating}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Modification...' : 'Modifier le rôle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRoleManager;

