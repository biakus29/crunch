import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, query, collection, where, getDocs, increment } from 'firebase/firestore';
import { FaCheckCircle, FaTruck, FaSpinner } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ConfirmDelivery = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      
      if (!orderDoc.exists()) {
        toast.error('Commande introuvable');
        setLoading(false);
        return;
      }

      const orderData = { id: orderDoc.id, ...orderDoc.data() };
      setOrder(orderData);

      // Vérifier si déjà livrée
      if (orderData.status === 'livree' || orderData.status === 'delivered') {
        setConfirmed(true);
      }

      setLoading(false);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur de chargement');
      setLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;

    setConfirming(true);

    try {
      const updateData = {
        status: 'livree',
        deliveryCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Calculer la durée si deliveryStartedAt existe
      if (order.deliveryStartedAt) {
        const startTime = order.deliveryStartedAt.toDate();
        const endTime = new Date();
        const durationMinutes = Math.round((endTime - startTime) / 1000 / 60);
        updateData.deliveryDurationMinutes = durationMinutes;
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);

      // Mettre à jour les statistiques du livreur
      if (order.assignedDeliverer && order.assignedDeliverer !== 'Non assigné') {
        try {
          const deliverersQuery = query(
            collection(db, 'deliverers'),
            where('name', '==', order.assignedDeliverer),
            where('restaurantId', '==', order.restaurantId)
          );
          const deliverersSnap = await getDocs(deliverersQuery);
          
          if (!deliverersSnap.empty) {
            const delivererDoc = deliverersSnap.docs[0];
            await updateDoc(doc(db, 'deliverers', delivererDoc.id), {
              totalDeliveries: increment(1),
              earnings: increment(order.deliveryFee || 0)
            });
          }
        } catch (error) {
          console.error('Erreur mise à jour livreur:', error);
          // Ne pas bloquer la confirmation si erreur
        }
      }

      setConfirmed(true);
      toast.success('Livraison confirmée avec succès !');
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la confirmation');
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Commande introuvable</h1>
          <p className="text-gray-600 mb-6">
            Cette commande n'existe pas ou le lien est invalide.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center p-4">
        <ToastContainer position="top-center" autoClose={3000} />
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-6">
            <FaCheckCircle className="text-6xl text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Livraison confirmée !
          </h1>
          <p className="text-gray-600 mb-2">
            Merci d'avoir confirmé la réception de votre commande.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Commande #{order.id.slice(-6).toUpperCase()}
          </p>
          
          {order.deliveryDurationMinutes && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 font-medium">
                ⏱️ Temps de livraison : {order.deliveryDurationMinutes} minutes
              </p>
            </div>
          )}

          <div className="border-t pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Nous espérons que vous avez apprécié votre repas !
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vérifier si la commande est en livraison
  const isDelivering = order.status === 'en_livraison' || order.status === 'delivering';

  if (!isDelivering) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Commande pas encore en livraison
          </h1>
          <p className="text-gray-600 mb-6">
            Cette commande n'a pas encore été prise en charge par un livreur.
          </p>
          <div className="bg-orange-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-800">
              Statut actuel : <span className="font-bold">{order.status}</span>
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <ToastContainer position="top-center" autoClose={3000} />
      
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <FaTruck className="text-4xl text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Confirmer la livraison
          </h1>
          <p className="text-gray-600">
            Avez-vous bien reçu votre commande ?
          </p>
        </div>

        {/* Infos commande */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">Numéro de commande</span>
            <span className="font-bold text-gray-900">
              #{order.id.slice(-6).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600">Livreur</span>
            <span className="font-medium text-gray-900">
              {order.assignedDeliverer || 'Non assigné'}
            </span>
          </div>
          {order.deliveryFee && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Frais de livraison</span>
              <span className="font-bold text-green-600">
                {order.deliveryFee.toLocaleString()} FCFA
              </span>
            </div>
          )}
        </div>

        {/* Message important */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ <strong>Important :</strong> Ne confirmez que si vous avez bien reçu votre commande.
          </p>
        </div>

        {/* Boutons */}
        <div className="space-y-3">
          <button
            onClick={handleConfirmDelivery}
            disabled={confirming}
            className={`w-full py-4 rounded-lg font-bold text-white transition flex items-center justify-center ${
              confirming
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {confirming ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Confirmation en cours...
              </>
            ) : (
              <>
                <FaCheckCircle className="mr-2" />
                Oui, j'ai reçu ma commande
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
        </div>

        {/* Contact */}
        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-xs text-gray-500">
            Un problème avec votre commande ?<br />
            Contactez-nous au support
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDelivery;
