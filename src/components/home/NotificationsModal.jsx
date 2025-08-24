import React from 'react';

const NotificationsModal = ({
  isOpen,
  notifications = [],
  onClose,
  onMarkAllRead,
  onClearAll,
  onItemClick,
  formatOrderId,
  STATUS_LABELS,
  STATUS_COLORS,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95 hover:scale-100">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <button
            onClick={() => {
              onMarkAllRead?.();
              onClose?.();
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-4">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center">Aucune notification pour le moment</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    notification.read ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200 hover:bg-green-100'
                  }`}
                  onClick={() => onItemClick?.(notification)}
                >
                  <p className="text-sm text-gray-700">
                    Commande #{formatOrderId(notification.orderId)} :{' '}
                    <span className={`font-medium ${STATUS_COLORS[notification.oldStatus]}`}>
                      {STATUS_LABELS[notification.oldStatus] || 'Nouveau'}
                    </span>{' '}
                    →{' '}
                    <span className={`font-medium ${STATUS_COLORS[notification.newStatus]}`}>
                      {STATUS_LABELS[notification.newStatus]}
                    </span>
                  </p>
                  {notification.newStatus === 'echec' && notification.reason && (
                    <p className="text-sm text-red-600 mt-1">Motif : {notification.reason}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{notification.timestamp.toLocaleString('fr-FR')}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClearAll}
              className="text-red-600 hover:text-red-800 text-sm flex items-center"
            >
              <i className="fas fa-trash-alt mr-1"></i> Vider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsModal;
