import React from 'react';

const PromotionFilters = ({ filter, onChange, count, onCreate }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
      <div className="flex items-center space-x-4">
        <select
          value={filter}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Toutes les promotions</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
          <option value="expired">Expirées</option>
        </select>
        <span className="text-sm text-gray-600">{count} promotion(s)</span>
      </div>
      <button
        onClick={onCreate}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        Nouvelle promotion
      </button>
    </div>
  );
};

export default PromotionFilters;
