import React, { useState } from 'react';
import { doc, collection, addDoc, serverTimestamp,updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const OrderRating = ({ order, userId }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setSubmissionStatus('error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Référence à la nouvelle collection ratings
      const ratingsRef = collection(db, 'ratings');
      
      // Données à enregistrer
      const ratingData = {
        orderId: order.id,
        userId: userId || null,
        restaurantId: order.restaurantId,
        rating,
        comment: comment.trim() || null,
        date: serverTimestamp(),
        items: order.items.map(item => ({
          dishId: item.dishId,
          name: item.dishName,
          quantity: item.quantity
        })),
        deliveryRating: null, // Pour éventuellement noter la livraison séparément
        serviceRating: null   // Pour éventuellement noter le service
      };

      // Ajouter le document à la collection ratings
      await addDoc(ratingsRef, ratingData);

      // Optionnel : marquer la commande comme évaluée
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        isRated: true,
        lastUpdated: serverTimestamp()
      });

      setSubmissionStatus('success');
    } catch (error) {
      console.error("Error submitting rating:", error);
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si la commande a déjà été évaluée
  if (order.isRated) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="text-center">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
          <h3 className="text-xl font-semibold mb-2">Merci pour votre évaluation !</h3>
          <p className="text-gray-600">
            Votre feedback nous aide à améliorer notre service.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Évaluez votre commande</h3>
      
      {submissionStatus === 'success' ? (
        <div className="text-center">
          <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
          <p className="text-lg">Merci pour votre évaluation !</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note globale
            </label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-3xl focus:outline-none ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  {rating >= star ? '★' : '☆'}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Pas satisfait</span>
              <span>Très satisfait</span>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Commentaire (optionnel)
            </label>
            <textarea
              id="comment"
              rows="3"
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Dites-nous ce que vous avez pensé de votre commande..."
            ></textarea>
          </div>

          {submissionStatus === 'error' && (
            <p className="text-red-500 text-sm mb-4">
              {rating === 0 ? 'Veuillez sélectionner une note' : 'Une erreur est survenue, veuillez réessayer'}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Envoi en cours...
              </>
            ) : (
              'Envoyer mon évaluation'
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default OrderRating;