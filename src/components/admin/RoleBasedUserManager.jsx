import React, { useEffect, useState } from 'react';
import { db, auth } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  query,
  where
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  FaUserTie, 
  FaEdit, 
  FaTrash, 
  FaPlus, 
  FaUsers,
  FaCalculator,
  FaUtensils,
  FaShoppingCart,
  FaBox,
  FaEye,
  FaEyeSlash,
  FaRandom,
  FaCopy
} from 'react-icons/fa';
import { ROLES, ROLE_LABELS } from '../../utils/rolePermissions';

const RoleBasedUserManager = ({ currentRestaurantId, canAccessAllRestaurants = false }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState(null);
  const [createdUserInfo, setCreatedUserInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: ROLES.ORDER_MANAGER
  });
  const [userExists, setUserExists] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  // Icônes pour chaque rôle
  const roleIcons = {
    [ROLES.MANAGER]: <FaUserTie className="text-purple-600" />,
    [ROLES.ACCOUNTANT]: <FaCalculator className="text-green-600" />,
    [ROLES.KITCHEN_SUPPLY]: <FaUtensils className="text-orange-600" />,
    [ROLES.ORDER_MANAGER]: <FaShoppingCart className="text-blue-600" />,
    [ROLES.SUPPLY_MANAGER]: <FaBox className="text-teal-600" />
  };

  // Générer un mot de passe sécurisé
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Copier le mot de passe dans le presse-papiers
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Mot de passe copié dans le presse-papiers !');
    }).catch(() => {
      alert('Erreur lors de la copie');
    });
  };

  // Vérifier si l'utilisateur existe déjà
  const checkUserExists = async (email) => {
    if (!email || !email.includes('@')) {
      setUserExists(false);
      return;
    }

    setCheckingUser(true);
    try {
      const existingUserQuery = query(
        collection(db, 'usersrestau'),
        where('email', '==', email.trim())
      );
      const existingUserSnap = await getDocs(existingUserQuery);
      
      if (!existingUserSnap.empty) {
        const userData = existingUserSnap.docs[0].data();
        setUserExists(true);
        // Pré-remplir les champs avec les données existantes
        setForm(prev => ({
          ...prev,
          name: userData.name || prev.name,
          phone: userData.phone || prev.phone,
          role: userData.role === 'pending' ? ROLES.ORDER_MANAGER : userData.role || prev.role
        }));
      } else {
        setUserExists(false);
        // Générer un mot de passe seulement pour les nouveaux utilisateurs
        if (!form.password) {
          setForm(prev => ({ ...prev, password: generatePassword() }));
        }
      }
    } catch (error) {
      console.error('Erreur vérification utilisateur:', error);
      setUserExists(false);
    } finally {
      setCheckingUser(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentRestaurantId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Charger tous les utilisateurs liés au restaurant
      const usersQuery = query(
        collection(db, 'usersrestau'),
        where('restaurantId', '==', currentRestaurantId)
      );
      const usersSnap = await getDocs(usersQuery);
      
      const userData = usersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUsers(userData);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: ROLES.ORDER_MANAGER
    });
    setCreatedUserInfo(null);
    setUserExists(false);
    setCheckingUser(false);
  };

  const assignRoleToUser = async () => {
    try {
      if (!form.email || !form.name || !form.role) {
        alert('Email, nom et rôle sont requis');
        return;
      }

      // Chercher si l'utilisateur existe déjà dans usersrestau
      const existingUserQuery = query(
        collection(db, 'usersrestau'),
        where('email', '==', form.email.trim())
      );
      const existingUserSnap = await getDocs(existingUserQuery);

      let uid;
      if (!existingUserSnap.empty) {
        // Utilisateur existe déjà, utiliser son UID
        const existingUser = existingUserSnap.docs[0];
        uid = existingUser.id;
        
        // Mettre à jour ses informations
        await updateDoc(doc(db, 'usersrestau', uid), {
          name: form.name,
          phone: form.phone || '',
          role: form.role,
          restaurantId: currentRestaurantId,
          active: true,
          updatedAt: serverTimestamp()
        });
      } else {
        // Créer un nouveau profil sans compte Auth (l'utilisateur se connectera avec son compte existant)
        const newUserRef = doc(collection(db, 'usersrestau'));
        uid = newUserRef.id;
        
        await setDoc(newUserRef, {
          name: form.name,
          email: form.email.trim(),
          phone: form.phone || '',
          role: form.role,
          restaurantId: currentRestaurantId,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Créer un document spécifique selon le rôle si nécessaire
      if (form.role === ROLES.SUPPLY_MANAGER) {
        await addDoc(collection(db, 'supplyManagers'), {
          name: form.name,
          email: form.email.trim(),
          phone: form.phone || '',
          role: form.role,
          restaurantId: currentRestaurantId,
          uid,
          active: true,
          createdAt: serverTimestamp()
        });
      }

      // Recharger la liste des utilisateurs
      await loadUsers();
      setShowCreate(false);
      resetForm();
      
      alert(`Rôle ${ROLE_LABELS[form.role]} attribué avec succès à ${form.email}`);
    } catch (error) {
      console.error('Erreur attribution rôle:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleUserSubmit = async () => {
    try {
      if (!form.email || !form.name || !form.role) {
        alert('Email, nom et rôle sont requis');
        return;
      }

      if (!userExists && !form.password) {
        alert('Mot de passe requis pour un nouvel utilisateur');
        return;
      }

      let uid;

      if (userExists) {
        // Utilisateur existant - Mettre à jour le profil seulement
        const existingUserQuery = query(
          collection(db, 'usersrestau'),
          where('email', '==', form.email.trim())
        );
        const existingUserSnap = await getDocs(existingUserQuery);
        
        if (!existingUserSnap.empty) {
          const existingUser = existingUserSnap.docs[0];
          uid = existingUser.id;
          
          // Mettre à jour ses informations
          await updateDoc(doc(db, 'usersrestau', uid), {
            name: form.name,
            phone: form.phone || '',
            role: form.role,
            restaurantId: currentRestaurantId,
            active: true, // Activer automatiquement lors de l'attribution de rôle
            updatedAt: serverTimestamp()
          });
        }
        
        // Pour utilisateur existant, ne pas afficher de mot de passe
        // Car nous ne pouvons pas le changer côté client
        alert(`Rôle ${ROLE_LABELS[form.role]} attribué avec succès à ${form.email}. L'utilisateur peut se connecter avec son mot de passe existant.`);
      } else {
        // Nouvel utilisateur - Créer le compte Auth
        const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
        uid = cred.user.uid;

        // Créer le profil utilisateur
        const userData = {
          name: form.name,
          email: form.email.trim(),
          phone: form.phone || '',
          role: form.role,
          restaurantId: currentRestaurantId,
          uid,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await setDoc(doc(db, 'usersrestau', uid), userData);
        setUsers(prev => [...prev, { id: uid, ...userData }]);
        
        // Sauvegarder les informations de connexion pour affichage (seulement pour nouveaux comptes)
        setCreatedUserInfo({
          name: form.name,
          email: form.email,
          password: form.password,
          role: ROLE_LABELS[form.role]
        });
      }

      // Créer un document spécifique selon le rôle si nécessaire
      if (form.role === ROLES.SUPPLY_MANAGER) {
        await addDoc(collection(db, 'supplyManagers'), {
          name: form.name,
          email: form.email.trim(),
          phone: form.phone || '',
          role: form.role,
          restaurantId: currentRestaurantId,
          uid,
          active: true,
          createdAt: serverTimestamp()
        });
      }

      // Recharger la liste des utilisateurs
      await loadUsers();
      setShowCreate(false);
      
      const message = userExists 
        ? `Rôle ${ROLE_LABELS[form.role]} attribué avec succès à ${form.email}`
        : `Utilisateur ${ROLE_LABELS[form.role]} créé avec succès`;
      
      if (userExists) {
        alert(message);
      }
    } catch (error) {
      console.error('Erreur création utilisateur:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const openEdit = (user) => {
    setSelected(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      role: user.role || ROLES.ORDER_MANAGER
    });
    setShowEdit(true);
  };

  const updateUser = async () => {
    try {
      if (!selected) return;

      const updatedData = {
        name: form.name,
        phone: form.phone,
        role: form.role,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'usersrestau', selected.id), updatedData);
      
      setUsers(prev => prev.map(user => 
        user.id === selected.id 
          ? { ...user, ...updatedData }
          : user
      ));
      
      setShowEdit(false);
      setSelected(null);
      resetForm();
      alert('Utilisateur mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    
    try {
      await deleteDoc(doc(db, 'usersrestau', userId));
      setUsers(prev => prev.filter(user => user.id !== userId));
      alert('Utilisateur supprimé');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      [ROLES.MANAGER]: 'bg-purple-100 text-purple-800',
      [ROLES.ACCOUNTANT]: 'bg-green-100 text-green-800',
      [ROLES.KITCHEN_SUPPLY]: 'bg-orange-100 text-orange-800',
      [ROLES.ORDER_MANAGER]: 'bg-blue-100 text-blue-800',
      [ROLES.SUPPLY_MANAGER]: 'bg-teal-100 text-teal-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2">Chargement des utilisateurs...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FaUsers /> Gestion des Utilisateurs par Rôles
          </h3>
          {!canAccessAllRestaurants && (
            <p className="text-sm text-gray-600 mt-1">
              🏪 Gestion limitée aux utilisateurs de votre restaurant
            </p>
          )}
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <FaPlus /> Gérer Utilisateur
        </button>
      </div>

      {/* Statistiques par rôle */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(ROLES).map(([key, role]) => {
          const count = users.filter(user => user.role === role).length;
          return (
            <div key={role} className="bg-white rounded-lg p-4 shadow border">
              <div className="flex items-center gap-2 mb-2">
                {roleIcons[role]}
                <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Table des utilisateurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Téléphone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {roleIcons[user.role]}
                    <span className="font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button 
                    onClick={() => openEdit(user)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <FaEdit />
                  </button>
                  <button 
                    onClick={() => deleteUser(user.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucun utilisateur trouvé
          </div>
        )}
      </div>

      {/* Modal Création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">
              Gestion Utilisateur
            </h4>
            
            {checkingUser && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  🔍 Vérification de l'utilisateur...
                </p>
              </div>
            )}
            
            {userExists && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-green-800">
                  ✅ <strong>Utilisateur existant détecté</strong> - Modification du rôle
                  {form.role === 'pending' && (
                    <span className="block mt-1 text-orange-700">
                      🔄 <strong>Utilisateur Google en attente</strong> - Attribution de rôle nécessaire
                    </span>
                  )}
                </p>
              </div>
            )}
            
            {!userExists && form.email && form.email.includes('@') && !checkingUser && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800">
                  🆕 <strong>Nouvel utilisateur</strong> - Création d'un compte complet
                </p>
              </div>
            )}
            <div className="space-y-3">
              <input 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                placeholder="Nom complet" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
              />
              <input 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                placeholder="Email" 
                type="email" 
                value={form.email} 
                onChange={e => {
                  const email = e.target.value;
                  setForm({ ...form, email });
                  // Vérifier automatiquement si l'utilisateur existe après 500ms
                  setTimeout(() => checkUserExists(email), 500);
                }}
              />
              {!userExists && form.email && form.email.includes('@') && !checkingUser && (
                <div className="relative">
                  <input 
                    className="w-full px-3 py-2 pr-20 border rounded focus:ring-2 focus:ring-blue-500" 
                    placeholder="Mot de passe" 
                    type={showPassword ? "text" : "password"}
                    value={form.password} 
                    onChange={e => setForm({ ...form, password: e.target.value })} 
                  />
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title={showPassword ? "Masquer" : "Afficher"}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, password: generatePassword() })}
                      className="p-1 text-blue-500 hover:text-blue-700"
                      title="Générer un nouveau mot de passe"
                    >
                      <FaRandom />
                    </button>
                  </div>
                </div>
              )}
              
              {userExists && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    <strong>Utilisateur existant :</strong> Le rôle sera mis à jour. L'utilisateur pourra se connecter avec son mot de passe existant.
                  </p>
                </div>
              )}
              <input 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                placeholder="Téléphone (optionnel)" 
                value={form.phone} 
                onChange={e => setForm({ ...form, phone: e.target.value })} 
              />
              <select 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                {Object.entries(ROLES).map(([key, role]) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button 
                onClick={handleUserSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {userExists ? 'Modifier Rôle' : 'Créer Compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Édition */}
      {showEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4">Modifier l'Utilisateur</h4>
            <div className="space-y-3">
              <input 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                placeholder="Nom complet" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
              />
              <input 
                className="w-full px-3 py-2 border rounded bg-gray-100" 
                placeholder="Email (non modifiable)" 
                type="email" 
                value={form.email} 
                disabled
              />
              <input 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" 
                placeholder="Téléphone" 
                value={form.phone} 
                onChange={e => setForm({ ...form, phone: e.target.value })} 
              />
              <select 
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                {Object.entries(ROLES).map(([key, role]) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => { setShowEdit(false); setSelected(null); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button 
                onClick={updateUser}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informations de Connexion */}
      {createdUserInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold mb-4 text-green-600">✅ Utilisateur créé avec succès !</h4>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h5 className="font-medium mb-3">Informations de connexion :</h5>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Nom :</span>
                  <span className="ml-2">{createdUserInfo.name}</span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Rôle :</span>
                  <span className="ml-2">{createdUserInfo.role}</span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Email :</span>
                  <span className="ml-2 font-mono bg-white px-2 py-1 rounded border">
                    {createdUserInfo.email}
                  </span>
                </div>
                
                <div>
                  <span className="font-medium text-gray-600">Mot de passe :</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono bg-white px-2 py-1 rounded border flex-1">
                      {createdUserInfo.password}
                    </span>
                    <button
                      onClick={() => copyToClipboard(createdUserInfo.password)}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Copier le mot de passe"
                    >
                      <FaCopy />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`border rounded-lg p-3 mb-4 ${
              createdUserInfo.isExisting 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <p className={`text-sm ${
                createdUserInfo.isExisting ? 'text-orange-800' : 'text-yellow-800'
              }`}>
                <strong>Important :</strong> 
                {createdUserInfo.isExisting 
                  ? ' Utilisateur existant - Communiquez ces nouvelles informations de connexion. Le mot de passe affiché peut être utilisé pour se connecter.'
                  : ' Communiquez ces informations à l\'utilisateur. Le mot de passe ne sera plus accessible après fermeture de cette fenêtre.'
                }
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => copyToClipboard(`Email: ${createdUserInfo.email}\nMot de passe: ${createdUserInfo.password}`)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <FaCopy /> Copier tout
              </button>
              <button 
                onClick={() => setCreatedUserInfo(null)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleBasedUserManager;
