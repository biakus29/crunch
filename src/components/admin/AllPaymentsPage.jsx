/**
 * Page complète de gestion des paiements - Affichage de toutes les données de commandes A-Z
 * Interface simple et claire pour visualiser tous les paiements et données financières
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { 
  Search, 
  Download, 
  RefreshCw, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  Truck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { collection, query, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';

// Statuts des commandes
const ORDER_STATUS = {
  'en_attente': { label: 'En attente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  'en_preparation': { label: 'En préparation', color: 'bg-blue-100 text-blue-800', icon: Package },
  'prete': { label: 'Prête', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
  'en_livraison': { label: 'En livraison', color: 'bg-indigo-100 text-indigo-800', icon: Truck },
  'livree': { label: 'Livrée', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'annulee': { label: 'Annulée', color: 'bg-red-100 text-red-800', icon: XCircle }
};

// Méthodes de paiement
const PAYMENT_METHODS = {
  'cash_delivery': { label: 'Cash à la livraison', icon: CreditCard, color: 'bg-green-50 text-green-700' },
  'mobile_money': { label: 'Mobile Money', icon: Phone, color: 'bg-blue-50 text-blue-700' },
  'card': { label: 'Carte bancaire', icon: CreditCard, color: 'bg-purple-50 text-purple-700' }
};

function AllPaymentsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Filtres
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Charger toutes les commandes
  const loadOrders = async (isInitial = false) => {
    try {
      setLoading(true);
      const ordersCol = collection(db, 'orders');
      let q = query(ordersCol, orderBy('timestamp', 'desc'), limit(100));
      
      if (!isInitial && lastVisible) {
        q = query(ordersCol, orderBy('timestamp', 'desc'), startAfter(lastVisible), limit(100));
      }

      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt)
      }));

      if (isInitial) {
        setOrders(newOrders);
      } else {
        setOrders(prev => [...prev, ...newOrders]);
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 100);
    } catch (error) {
      console.error('Erreur chargement commandes:', error);
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(true);
  }, []);

  // Filtrer les commandes par recherche et filtres
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Filtre par recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const phone = order.address?.phone || order.userId?.replace('guest-', '') || '';
        const address = order.address?.completeAddress || order.address?.area || '';
        const orderId = order.id || '';
        const total = order.total?.toString() || '';
        
        return phone.includes(term) || 
               address.toLowerCase().includes(term) || 
               orderId.toLowerCase().includes(term) ||
               total.includes(term);
      });
    }
    
    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Filtre par méthode de paiement
    if (paymentFilter !== 'all') {
      if (paymentFilter === 'paid') {
        filtered = filtered.filter(order => order.isPaid === true);
      } else if (paymentFilter === 'unpaid') {
        filtered = filtered.filter(order => order.isPaid === false);
      } else {
        filtered = filtered.filter(order => order.paymentMethod?.id === paymentFilter);
      }
    }
    
    // Filtre par date
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = null;
      }
      
      if (startDate) {
        filtered = filtered.filter(order => {
          const orderDate = order.timestamp || order.createdAt;
          return orderDate >= startDate;
        });
      }
    }
    
    return filtered;
  }, [orders, searchTerm, statusFilter, paymentFilter, dateFilter]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalAmount = filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const totalDelivery = filteredOrders.reduce((sum, order) => sum + (Number(order.deliveryFee) || 0), 0);
    const paidOrders = filteredOrders.filter(order => order.isPaid).length;
    const deliveredOrders = filteredOrders.filter(order => order.status === 'livree').length;

    return {
      totalOrders,
      totalAmount,
      totalDelivery,
      paidOrders,
      deliveredOrders,
      averageOrder: totalOrders > 0 ? totalAmount / totalOrders : 0
    };
  }, [filteredOrders]);

  // Exporter les données
  const exportData = () => {
    const csvData = filteredOrders.map(order => ({
      'ID Commande': order.id,
      'Date': order.timestamp?.toLocaleDateString?.() || 'N/A',
      'Client': order.address?.phone || order.userId?.replace('guest-', '') || 'N/A',
      'Téléphone': order.address?.phone || 'N/A',
      'Adresse': order.address?.completeAddress || order.address?.area || 'N/A',
      'Sous-total': Number(order.total || 0) - Number(order.deliveryFee || 0),
      'Livraison': Number(order.deliveryFee || 0),
      'Total': Number(order.total || 0),
      'Statut': order.status || 'N/A',
      'Payé': order.isPaid ? 'Oui' : 'Non',
      'Méthode': order.paymentMethod?.name || 'N/A',
      'Articles': order.items?.length || 0
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commandes-paiements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Toutes les Commandes & Paiements
        </h1>
        <p className="text-gray-600">
          Vue complète de toutes les données financières et de commandes
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Commandes</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Chiffre d'Affaires</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAmount.toLocaleString()} FCFA</p>
            </div>
            <CreditCard className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Commandes Payées</p>
              <p className="text-2xl font-bold text-gray-900">{stats.paidOrders}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Frais Livraison</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDelivery.toLocaleString()} FCFA</p>
            </div>
            <Truck className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Barre d'outils et filtres */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="space-y-4">
          {/* Ligne 1: Recherche et actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Rechercher par téléphone, adresse, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => loadOrders(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Exporter CSV
              </button>
            </div>
          </div>

          {/* Ligne 2: Filtres */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Filtre par statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut commande</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="en_preparation">En préparation</option>
                <option value="prete">Prête</option>
                <option value="en_livraison">En livraison</option>
                <option value="livree">Livrée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>

            {/* Filtre par paiement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paiement</label>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les paiements</option>
                <option value="paid">Payées</option>
                <option value="unpaid">Non payées</option>
                <option value="cash_delivery">Cash à la livraison</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="card">Carte bancaire</option>
              </select>
            </div>

            {/* Filtre par date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Période</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
            </div>
          </div>

          {/* Compteur de résultats */}
          <div className="text-sm text-gray-600">
            {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''} trouvée{filteredOrders.length > 1 ? 's' : ''}
            {(statusFilter !== 'all' || paymentFilter !== 'all' || dateFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setPaymentFilter('all');
                  setDateFilter('all');
                  setSearchTerm('');
                }}
                className="ml-2 text-blue-600 hover:text-blue-800 underline"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table des commandes */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande & Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client & Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adresse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut & Paiement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const status = ORDER_STATUS[order.status] || ORDER_STATUS['en_attente'];
                const paymentMethod = PAYMENT_METHODS[order.paymentMethod?.id] || PAYMENT_METHODS['cash_delivery'];
                const subtotal = (Number(order.total) || 0) - (Number(order.deliveryFee) || 0);
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          #{order.id.slice(-8)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.timestamp?.toLocaleDateString?.('fr-FR') || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.timestamp?.toLocaleTimeString?.('fr-FR') || ''}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {order.address?.phone || order.userId?.replace('guest-', '') || 'N/A'}
                          </span>
                        </div>
                        {order.address?.phone && (
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span className="text-xs text-gray-500">Client</span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {order.address?.completeAddress || order.address?.area || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.address?.city || 'Yaoundé'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">
                          Sous-total: <span className="font-medium">{subtotal.toLocaleString()} FCFA</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Livraison: <span className="font-medium">{(Number(order.deliveryFee) || 0).toLocaleString()} FCFA</span>
                        </div>
                        <div className="text-sm font-bold text-gray-900">
                          Total: {(Number(order.total) || 0).toLocaleString()} FCFA
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          <status.icon className="w-3 h-3 mr-1" />
                          {status.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            order.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {order.isPaid ? 'Payé' : 'Non payé'}
                          </span>
                        </div>
                        <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${paymentMethod.color}`}>
                          <paymentMethod.icon className="w-3 h-3 mr-1" />
                          {paymentMethod.label}
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Bouton Charger plus */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <button
              onClick={() => loadOrders(false)}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? 'Chargement...' : 'Charger plus'}
            </button>
          </div>
        )}
      </div>

      {/* Modal de détail */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Détails de la commande #{selectedOrder.id.slice(-8)}</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Informations client</h4>
                    <p className="text-sm text-gray-600">Téléphone: {selectedOrder.address?.phone || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Adresse: {selectedOrder.address?.completeAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Détails financiers</h4>
                    <p className="text-sm text-gray-600">Sous-total: {((Number(selectedOrder.total) || 0) - (Number(selectedOrder.deliveryFee) || 0)).toLocaleString()} FCFA</p>
                    <p className="text-sm text-gray-600">Livraison: {(Number(selectedOrder.deliveryFee) || 0).toLocaleString()} FCFA</p>
                    <p className="text-sm font-semibold text-gray-900">Total: {(Number(selectedOrder.total) || 0).toLocaleString()} FCFA</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Articles commandés</h4>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm">Article {index + 1}</span>
                        <span className="text-sm font-medium">
                          {item.quantity}x - {(Number(item.price) || 0).toLocaleString()} FCFA
                        </span>
                      </div>
                    )) || <p className="text-sm text-gray-500">Aucun article</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllPaymentsPage;
