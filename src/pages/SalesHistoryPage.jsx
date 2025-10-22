import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SalesHistory from '../components/SalesHistory';

const SalesHistoryPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 flex items-center px-4 py-3 shadow-sm">
        <button 
          onClick={() => navigate(-1)} 
          className="p-1 mr-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-center font-bold text-lg text-gray-900">
          Historique des Ventes
        </h1>
      </header>

      {/* Content */}
      <main className="p-4 max-w-7xl mx-auto">
        <SalesHistory />
      </main>
    </div>
  );
};

export default SalesHistoryPage;
