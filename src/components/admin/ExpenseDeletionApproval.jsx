import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  FaTrash,
  FaCheck,
  FaTimes,
  FaClock,
  FaUser,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';

const ExpenseDeletionApproval = ({ currentRestaurantId, userRole }) => {
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadDeletionRequests();
  }, [currentRestaurantId]);

  const loadDeletionRequests = async () => {
    try {
      setLoading(true);
      
      // Charger les demandes selon les permissions
      const requestsQuery = currentRestaurantId
        ? query(
            collection(db, 'expenseDeletionRequests'),
            where('restaurantId', '==', currentRestaurantId),
            where('status', '==', 'pending'),
            orderBy('requestedAt', 'desc')
          )
        : query(
            collection(db, 'expenseDeletionRequests'),
            where('status', '==', 'pending'),
            orderBy('requestedAt', 'desc')
          );

      const requestsSnap = await getDocs(requestsQuery);
      const requests = requestsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setDeletionRequests(requests);
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId, expenseId) => {
    if (processingId) return;
    
    try {
      setProcessingId(requestId);
      
      // Supprimer la dépense
      await deleteDoc(doc(db, 'expenses', expenseId));
      
      // Marquer la demande comme approuvée
      await updateDoc(doc(db, 'expenseDeletionRequests', requestId), {
        status: 'approved',
        approvedBy: userRole,
        approvedAt: serverTimestamp()
      });
      
      toast.success('Demande approuvée et dépense supprimée');
      loadDeletionRequests();
    } catch (error) {
      console.error('Erreur approbation:', error);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (processingId) return;
    
    try {
      setProcessingId(requestId);
      
      // Marquer la demande comme rejetée
      await updateDoc(doc(db, 'expenseDeletionRequests', requestId), {
        status: 'rejected',
        rejectedBy: userRole,
        rejectedAt: serverTimestamp()
      });
      
      toast.success('Demande rejetée');
      loadDeletionRequests();
    } catch (error) {
      console.error('Erreur rejet:', error);
      toast.error('Erreur lors du rejet');
    } finally {
      setProcessingId(null);
    }
  };

  const getRoleLabel = (role) => {
    const roleLabels = {
      'delivery_manager': 'Gestionnaire Livraison',
      'kitchen_supply': 'Responsable Cuisine',
      'order_manager': 'Gestionnaire Commandes',
      'supply_manager': 'Gestionnaire Appro'
    };
    return roleLabels[role] || role;
  };

  const getDepartmentBadge = (department) => {
    const departments = {
      'general': { label: '🏢 Général', color: 'bg-gray-100 text-gray-800' },
      'livraison': { label: '🚚 Livraison', color: 'bg-blue-100 text-blue-800' },
      'cuisine': { label: '👨‍🍳 Cuisine', color: 'bg-green-100 text-green-800' },
      'marketing': { label: '📢 Marketing', color: 'bg-purple-100 text-purple-800' },
      'maintenance': { label: '🔧 Maintenance', color: 'bg-orange-100 text-orange-800' }
    };
    
    const dept = departments[department] || { label: department, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${dept.color}`}>
        {dept.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 sm:text-xl">
            Demandes de Suppression de Dépenses
          </h3>
          <p className="text-sm text-gray-600">
            Approuvez ou rejetez les demandes de suppression
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FaExclamationTriangle className="text-orange-500" />
          <span className="text-sm font-medium text-orange-600">
            {deletionRequests.length} demande(s) en attente
          </span>
        </div>
      </div>

      {/* Liste des demandes */}
      {deletionRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FaCheck className="mx-auto h-12 w-12 text-green-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune demande en attente
          </h3>
          <p className="text-gray-500">
            Toutes les demandes de suppression ont été traitées.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {deletionRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Informations de la demande */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <h4 className="font-semibold text-gray-900">
                      {request.expenseData.description}
                    </h4>
                    {getDepartmentBadge(request.expenseData.department)}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-1">
                      <FaMoneyBillWave className="text-green-500" />
                      <span className="font-medium">
                        {request.expenseData.amount?.toLocaleString()} FCFA
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaCalendarAlt className="text-blue-500" />
                      <span>{request.expenseData.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaUser className="text-purple-500" />
                      <span>{getRoleLabel(request.requestedBy)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaClock className="text-orange-500" />
                      <span>
                        {request.requestedAt?.toDate().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {request.expenseData.supplier && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Fournisseur:</span> {request.expenseData.supplier}
                    </p>
                  )}
                  
                  {request.expenseData.notes && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notes:</span> {request.expenseData.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 sm:flex-col">
                  <button
                    onClick={() => handleApproveRequest(request.id, request.expenseId)}
                    disabled={processingId === request.id}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-200 flex items-center justify-center gap-2 text-sm sm:flex-none sm:px-4"
                  >
                    {processingId === request.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FaCheck />
                        Approuver
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => handleRejectRequest(request.id)}
                    disabled={processingId === request.id}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200 flex items-center justify-center gap-2 text-sm sm:flex-none sm:px-4"
                  >
                    {processingId === request.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <FaTimes />
                        Rejeter
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpenseDeletionApproval;
