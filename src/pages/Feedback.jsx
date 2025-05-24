import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Assurez-vous que le chemin est correct
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

const FeedbackManager = ({ restaurantId }) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Récupérer les avis en temps réel avec onSnapshot
  useEffect(() => {
    if (!restaurantId) {
      setError('ID du restaurant manquant');
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'feedback'),
      where('restaurantId', '==', restaurantId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const feedbackData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate(), // Convertir Timestamp en Date JS
        })).sort((a, b) => b.timestamp - a.timestamp); // Trier par date décroissante
        setFeedbacks(feedbackData);
        setLoading(false);
      },
      (err) => {
        console.error('Erreur lors de la récupération des avis:', err);
        setError('Erreur lors du chargement des avis');
        setLoading(false);
      }
    );

    // Nettoyage de l'écouteur lors du démontage
    return () => unsubscribe();
  }, [restaurantId]);

  // Supprimer un avis
  const handleDeleteFeedback = async (feedbackId) => {
    if (window.confirm('Voulez-vous vraiment supprimer cet avis ?')) {
      try {
        await deleteDoc(doc(db, 'feedback', feedbackId));
        console.log(`Avis ${feedbackId} supprimé avec succès`);
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'avis:', error);
        setError('Erreur lors de la suppression de l\'avis');
      }
    }
  };

  // Formatter la date
  const formatDate = (date) => {
    return date ? new Date(date).toLocaleString('fr-FR') : 'Date inconnue';
  };

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600" role="status">
          <span className="sr-only">Chargement...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-600 p-4" role="alert">{error}</p>;
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Gestion des Avis</h3>
      {feedbacks.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Aucun avis disponible pour le moment</p>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="font-semibold text-gray-800 mr-2">
                      {feedback.userName || 'Anonyme'}
                    </span>
                    <span className="text-yellow-500 text-sm">
                      {'★'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{feedback.comment || 'Aucun commentaire'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Date: {formatDate(feedback.timestamp)}
                  </p>
                  {feedback.orderId && (
                    <p className="text-xs text-gray-500">
                      Commande: #{feedback.orderId.slice(0, 6)}
                    </p>
                  )}
                </div>
                <button
                  className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
                  onClick={() => handleDeleteFeedback(feedback.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackManager;