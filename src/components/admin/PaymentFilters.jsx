import React from 'react';

const PaymentFilters = ({
  searchTerm,
  filterStatus,
  filterMethod,
  dateRange,
  onSearch,
  onStatusChange,
  onMethodChange,
  onDateRangeChange,
  resultsCount,
  hideTestPayments = true,
  onToggleHideTest
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="false">Non payé</option>
            <option value="completed">Complété</option>
            <option value="failed">Échoué</option>
            <option value="refunded">Remboursé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
        <div>
          <select
            value={filterMethod}
            onChange={(e) => onMethodChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les méthodes</option>
            <option value="card">Carte bancaire</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Virement bancaire</option>
            <option value="cash">Espèces</option>
          </select>
        </div>
        <div>
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes les dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
        </div>
        <div className="flex items-center">
          <label className="inline-flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={hideTestPayments}
              onChange={(e) => onToggleHideTest && onToggleHideTest(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Masquer paiements de test</span>
          </label>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          {resultsCount} résultat(s)
        </div>
      </div>
    </div>
  );
};

export default PaymentFilters;
