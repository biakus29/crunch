import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../../firebase';
import { signOut } from 'firebase/auth';
import {
  FaBox,
  FaShoppingCart,
  FaMapMarkerAlt,
  FaChartLine,
  FaMotorcycle,
  FaMoneyBillWave,
  FaBars,
  FaTimes,
  FaUsers,
  FaClock,
  FaTruck,
  FaReceipt,
  FaArrowLeft,
  FaSignOutAlt,
} from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import PartnerProducts from './PartnerProducts';
import PartnerOrders from './PartnerOrders';
import PartnerQuartiersManager from './PartnerQuartiersManager';
import PartnerStats from './PartnerStats';
import DeliverersManagement from './DeliverersManagement';

// Import des composants de livraison du restaurant
import DeliveryFinancialDashboard from '../DeliveryFinancialDashboard';
import DeliveryTracking from '../DeliveryTracking';
import DeliveryExpensesManager from '../DeliveryExpensesManager';
import DeliveryShiftManager from '../DeliveryShiftManager';
import DeliveryManager from '../DeliveryManager';

// Structure organisée du menu par catégories
const MENU_SECTIONS = [
  {
    title: '📊 Vue d\'ensemble',
    items: [
      { id: 'dashboard', label: 'Tableau de Bord', icon: FaChartLine },
      { id: 'stats', label: 'CA Partenaires', icon: FaMoneyBillWave },
    ]
  },
  {
    title: '🛍️ Produits & Commandes',
    items: [
      { id: 'products', label: 'Produits', icon: FaBox },
      { id: 'orders', label: 'Commandes', icon: FaShoppingCart },
    ]
  },
  {
    title: '🚚 Livraisons',
    items: [
      { id: 'tracking', label: 'Suivi Livraisons', icon: FaTruck },
      { id: 'deliverers', label: 'Livreurs', icon: FaUsers },
      { id: 'shifts', label: 'Horaires Livreurs', icon: FaClock },
      { id: 'expenses', label: 'Dépenses Livraison', icon: FaReceipt },
    ]
  },
  {
    title: '⚙️ Configuration',
    items: [
      { id: 'quartiers', label: 'Quartiers', icon: FaMapMarkerAlt },
    ]
  }
];

// Liste plate pour la navigation mobile
const MENU_ITEMS = MENU_SECTIONS.flatMap(section => section.items);

const PartnerDashboardResponsive = ({ currentRestaurantId, userRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authUser, setAuthUser] = useState(undefined);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [partnerRestaurantId, setPartnerRestaurantId] = useState(currentRestaurantId);
  
  // Vérifier si on vient du dashboard restaurant ou gestionnaire
  const fromRestaurantDashboard = location.state?.restaurantId;
  const fromDeliveryManager = location.state?.fromDeliveryManager;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setAuthUser(u || null);
      // Si currentRestaurantId n'est pas fourni, essayer de le récupérer depuis l'utilisateur
      if (!currentRestaurantId && u) {
        // Pour les partenaires, utiliser un restaurantId par défaut ou le récupérer depuis Firestore
        // Pour l'instant, on utilise un ID fixe pour les tests
        setPartnerRestaurantId(u.uid); // ou récupérer depuis la base de données
      }
    });
    return () => unsubscribe();
  }, [currentRestaurantId]);

  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-600">
        Chargement…
      </div>
    );
  }

  if (authUser === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
        <div className="bg-white p-6 rounded shadow-md w-full max-w-lg text-center">
          <h2 className="text-2xl font-semibold text-blue-700 mb-4">
            Service Livraisons — Partenaires
          </h2>
          <p className="mb-4">Cette section nécessite une connexion dédiée pour le service partenaires.</p>
          <div className="space-y-2">
            <a
              href="/login-partners"
              className="inline-block w-full bg-blue-600 text-white px-4 py-2 rounded"
            >
              Se connecter (service partenaires)
            </a>
            <div className="text-sm text-gray-600 mt-2">
              Remarque: ce login est distinct du login restaurant.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Vérifier si restaurantId est disponible pour les sections qui en ont besoin
    const needsRestaurantId = ['dashboard', 'tracking', 'deliverers', 'expenses', 'shifts'];
    
    if (needsRestaurantId.includes(activeTab) && !partnerRestaurantId) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-600 mb-2">
            <FaBox className="w-12 h-12 mx-auto mb-3" />
          </div>
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            Configuration requise
          </h3>
          <p className="text-yellow-700 mb-4">
            Cette section nécessite un restaurant associé. Veuillez contacter l'administrateur pour configurer votre compte partenaire.
          </p>
          <p className="text-sm text-yellow-600">
            Restaurant ID: {partnerRestaurantId || 'Non configuré'}
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'products':
        return <PartnerProducts currentRestaurantId={partnerRestaurantId} />;
      case 'orders':
        return <PartnerOrders currentRestaurantId={partnerRestaurantId} />;
      case 'dashboard':
        return <DeliveryFinancialDashboard currentRestaurantId={partnerRestaurantId} />;
      case 'tracking':
        return <DeliveryTracking currentRestaurantId={partnerRestaurantId} />;
      case 'deliverers':
        return <DeliveryManager currentRestaurantId={partnerRestaurantId} />;
      case 'expenses':
        return <DeliveryExpensesManager currentRestaurantId={partnerRestaurantId} userRole={userRole} />;
      case 'shifts':
        return <DeliveryShiftManager currentRestaurantId={partnerRestaurantId} />;
      case 'quartiers':
        return <PartnerQuartiersManager />;
      case 'stats':
        return <PartnerStats currentRestaurantId={partnerRestaurantId} userRole={userRole} />;
      default:
        return null;
    }
  };

  const handleMenuClick = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login-partners');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Mobile Header */}
      <div className="lg:hidden bg-gradient-to-r from-blue-600 to-blue-700 border-b sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {(fromRestaurantDashboard || fromDeliveryManager) ? (
              <button
                onClick={() => navigate(fromDeliveryManager ? '/delivery-manager' : '/admin')}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
                title={fromDeliveryManager ? "Retour au dashboard gestionnaire" : "Retour au dashboard restaurant"}
              >
                <FaArrowLeft className="w-5 h-5 text-white" />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                {sidebarOpen ? <FaTimes className="w-5 h-5 text-white" /> : <FaBars className="w-5 h-5 text-white" />}
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-white">Dashboard Partenaires</h1>
              <p className="text-xs text-blue-100">
                {MENU_ITEMS.find((item) => item.id === activeTab)?.label}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {(fromRestaurantDashboard || fromDeliveryManager) && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                {sidebarOpen ? <FaTimes className="w-5 h-5 text-white" /> : <FaBars className="w-5 h-5 text-white" />}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              title="Déconnexion"
            >
              <FaSignOutAlt className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-64 bg-white border-r min-h-screen sticky top-0">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold text-blue-700">Dashboard</h1>
              {(fromRestaurantDashboard || fromDeliveryManager) && (
                <button
                  onClick={() => navigate(fromDeliveryManager ? '/delivery-manager' : '/admin')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={fromDeliveryManager ? "Retour au dashboard gestionnaire" : "Retour au dashboard restaurant"}
                >
                  <FaArrowLeft className="text-gray-600" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600">Partenaires</p>
          </div>
          <nav className="p-4 space-y-6">
            {MENU_SECTIONS.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                          activeTab === item.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* Bouton de déconnexion en bas de la sidebar */}
            <div className="mt-6 pt-6 border-t">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="font-medium text-sm">Déconnexion</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-xl overflow-y-auto">
              <div className="p-6 border-b">
                <h1 className="text-xl font-bold text-blue-700">Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">Partenaires</p>
              </div>
              <nav className="p-4 space-y-6">
                {MENU_SECTIONS.map((section, sectionIndex) => (
                  <div key={sectionIndex}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                      {section.title}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleMenuClick(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                              activeTab === item.id
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="font-medium text-sm">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Bouton de déconnexion en bas de la sidebar mobile */}
                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt className="w-5 h-5" />
                    <span className="font-medium text-sm">Déconnexion</span>
                  </button>
                </div>
              </nav>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 bg-gray-50">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {MENU_ITEMS.find((item) => item.id === activeTab)?.label}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Gérez vos {MENU_ITEMS.find((item) => item.id === activeTab)?.label.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {MENU_ITEMS.find((item) => item.id === activeTab)?.icon && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      {React.createElement(
                        MENU_ITEMS.find((item) => item.id === activeTab)?.icon,
                        { className: 'w-6 h-6 text-blue-600' }
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-7xl">{renderContent()}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Alternative) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-30">
        <div className="flex justify-around">
          {MENU_ITEMS.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 ${
                  activeTab === item.id ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs">{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Spacer for bottom nav */}
      <div className="lg:hidden h-16" />
    </div>
  );
};

export default PartnerDashboardResponsive;
