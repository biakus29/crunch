import React from "react";
import { FaStar } from "react-icons/fa";

const CommentsSection = React.memo(function CommentsSection({ feedbacks, usersData, orders }) {
  // Vérification de sécurité pour éviter les erreurs si usersData n'est pas encore chargé
  const safeUsersData = usersData || { byId: {}, byPhone: {} };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Avis et Commentaires Clients</h2>
      {feedbacks.length === 0 ? (
        <div className="text-center py-8">
          <i className="fas fa-comment-slash text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-500">Aucun avis client pour le moment</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feedbacks.map((feedback) => {
            // Récupérer les informations de l'utilisateur ou du client
            const user = feedback.userId
              ? safeUsersData.byId?.[feedback.userId]
              : feedback.contact?.phone && safeUsersData.byPhone?.[feedback.contact.phone];
            const clientInfo = user
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.email ||
                "Utilisateur inconnu"
              : feedback.contact?.name ||
                (feedback.contact?.phone ? `Client (${feedback.contact.phone})` : "Client anonyme");

            // Formater la date du feedback
            const feedbackDate = feedback.timestamp
              ? new Date(
                  typeof feedback.timestamp === "object" && "seconds" in feedback.timestamp
                    ? feedback.timestamp.seconds * 1000
                    : feedback.timestamp
                ).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Date inconnue";

            // Récupérer la commande associée pour afficher les articles
            const order = orders?.find((o) => o.id === feedback.orderId);

            return (
              <div
                key={feedback.id}
                className="p-6 border rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{clientInfo}</h4>
                    <p className="text-sm text-gray-500">
                      Commande #{feedback.orderId?.slice(0, 8)} • {feedbackDate}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600">
                      Recommande : {feedback.recommend ? "✅ Oui" : "❌ Non"}
                    </span>
                  </div>
                </div>

                {/* Évaluations par étoiles */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Service de livraison</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <i
                          key={i}
                          className={`fas fa-star ${
                            i <= (feedback.deliveryService || 0) ? "text-yellow-400" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Système de commande</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <i
                          key={i}
                          className={`fas fa-star ${
                            i <= (feedback.foodQuality || 0) ? "text-yellow-400" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Afficher le commentaire sur les points de fidélité */}
                {feedback.pointsExperience && (
                  <div className="bg-gray-50 p-4 rounded-lg mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Commentaire sur les points :</p>
                    <p className="text-gray-700 italic">"{feedback.pointsExperience}"</p>
                  </div>
                )}

                {/* Afficher les articles de la commande si disponibles */}
                {order && order.items && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Articles commandés :</p>
                    <div className="text-sm text-blue-700">
                      {order.items.map((item, index) => (
                        <span key={index}>
                          {item.dishName || "Article"} (x{item.quantity || 1})
                          {index < order.items.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default CommentsSection;
