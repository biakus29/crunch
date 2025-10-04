
import React from 'react';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Application en maintenance</h1>
        <p className="text-gray-600 mb-6">
          Notre application est actuellement en maintenance. Nous serons de retour bientôt ! Pour toute question, contactez-nous via WhatsApp.
        </p>
        <a
          href="https://wa.me/+237677544328"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-green-500 text-white font-semibold py-2 px-4 rounded hover:bg-green-600 transition-colors"
        >
          Contacter via WhatsApp
        </a>
      </div>
    </div>
  );
};

export default MaintenancePage;
