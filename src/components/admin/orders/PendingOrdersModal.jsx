import React from "react";
import OrderCard from "./OrderCard";

const PendingOrdersModal = ({ orders, items, extraLists, usersData, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Commandes en attente</h3>
          <button
            className="text-gray-500 hover:text-gray-700 text-xl"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center">Aucune commande en attente</p>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                items={items}
                extraLists={extraLists}
                usersData={usersData}
                onShowDetails={() => {}}
                onDragStart={() => {}}
                onDragEnd={() => {}}
              />
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingOrdersModal;
