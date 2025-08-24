import React from "react";
import { FaStar } from "react-icons/fa";

const CommentsSection = React.memo(function CommentsSection({ feedbacks, usersData }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Avis Clients</h2>
      {feedbacks.length === 0 ? (
        <p className="text-gray-500 text-center py-4">Aucun avis pour le moment</p>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <div key={feedback.id} className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FaStar className="text-yellow-400" />
                  <span className="font-semibold">{feedback.rating.rating}/5</span>
                </div>
                <span className="text-sm text-gray-500">
                  {feedback.timestamp
                    ? new Date(feedback.timestamp.seconds * 1000).toLocaleString("fr-FR")
                    : "Date inconnue"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{feedback.comment}</p>
              <p className="text-xs text-gray-500 mt-1">
                Par: {usersData.byId[feedback.userId]?.email || "Utilisateur inconnu"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default CommentsSection;
