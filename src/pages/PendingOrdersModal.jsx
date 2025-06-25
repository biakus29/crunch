import React from "react";
import OrderCard from "./OrderCard";

const PendingOrdersModal = ({
  showPendingOrdersModal,
  setShowPendingOrdersModal,
  pendingOrders,
  items,
  extraLists,
  usersData,
  showOrderDetails,
}) => {
  if (!showPendingOrdersModal) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-lg">Commandes en attente</h3>
        {pendingOrders.length === 0 ? (
          <p>Aucune commande en attente.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                items={items}
                extraLists={extraLists}
                usersData={usersData}
                onShowDetails={() => showOrderDetails(order)}
                onDragStart={() => {}}
                onDragEnd={() => {}}
              />
            ))}
          </div>
        )}
        <div className="modal-action">
          <button
            className="btn btn-secondary"
            onClick={() => setShowPendingOrdersModal(false)}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingOrdersModal;