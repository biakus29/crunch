import React, { Suspense, lazy } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/cartcontext";
import { AuthProvider } from "./context/authcontext";
import ErrorBoundary, { SuspenseFallback } from "./components/common/ErrorBoundary";
// Global styles
import '@fortawesome/fontawesome-free/css/all.min.css';

// Lazy-loaded pages (route-based code splitting)
const Admin = lazy(() => import('./pages/Admin'));
const Accueil = lazy(() => import('./pages/acceuil'));
const Panier = lazy(() => import('./pages/panier'));
const AddRestaurant = lazy(() => import('./pages/Addrestaurants'));
const RestaurantAdmin = lazy(() => import('./pages/restaurantadmin'));
const Login = lazy(() => import('./pages/loginrestau'));
const AdminRedirect = lazy(() => import('./components/common/AdminRedirect'));
const OrdersPage = lazy(() => import('./pages/oders'));
const ProductDetails = lazy(() => import('./pages/detail'));
const OrderAddress = lazy(() => import('./pages/oderdetails'));
const CategoryListing = lazy(() => import('./pages/categorieslist'));
const FinalOrderStatus = lazy(() => import('./pages/ordersstatuts'));
const Profile = lazy(() => import('./pages/profile'));
const Auth = lazy(() => import('./pages/login'));
const QuartiersAdmin = lazy(() => import('./pages/quartieradmin'));
const EmployeeManager = lazy(() => import('./pages/employer'));
const ThankYouPage = lazy(() => import('./pages/ordersstatuts').then(m => ({ default: m.ThankYouPage })));
const Logins = lazy(() => import('./pages/loginstart'));
const MenuPage = lazy(() => import('./pages/menu'));
const PaymentSuccess = lazy(() => import('./pages/payementsuccess'));
const PaymentFailure = lazy(() => import('./pages/payementfailed'));
const SuperAdmin = lazy(() => import('./pages/superadmin'));
const CartPage = lazy(() => import('./pages/panier'));
const MaintenancePage = lazy(() => import('./pages/maintenance'));
const ChangerId = lazy(() => import('./pages/maj'));
const OrderTracking = lazy(() => import('./pages/ordertrack'));
const ProtectedRoute = lazy(() => import('./components/common/ProtectedRoute').then(module => ({ default: module.ProtectedRoute })));
const CompleteOrderPage = lazy(() => import('./pages/complete_order'));
const PayRedirect = lazy(() => import('./pages/PayRedirect'));
const TrackRedirect = lazy(() => import('./pages/TrackRedirect'));
const AmbassadorDashboard = lazy(() => import('./pages/AmbassadorDashboard'));
const SupplyManagerDashboard = lazy(() => import('./pages/SupplyManagerDashboard'));
const DeliveryPersonApp = lazy(() => import('./pages/DeliveryPersonApp'));
const DeliveryPersonLogin = lazy(() => import('./pages/DeliveryPersonLogin'));
const DeliveryInfo = lazy(() => import('./pages/DeliveryInfo'));
const ConfirmDelivery = lazy(() => import('./pages/ConfirmDelivery'));
const DeliveryManagerMobile = lazy(() => import('./pages/DeliveryManagerMobile'));
const CsvDemo = lazy(() => import('./pages/CsvDemo'));
const HistoriqueCommandes = lazy(() => import('./pages/HistoriqueCommandes'));
const SalesHistoryPage = lazy(() => import('./pages/SalesHistoryPage'));

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <HelmetProvider>
          <Router>
            <ErrorBoundary>
              <Suspense fallback={<SuspenseFallback />}>
                <Routes>
              <Route path="/" element={<Login/>} />
              <Route path="/login" element={<Auth />} />
              <Route path="/accueil" element={<Accueil />} />
              
              {/* Routes protégées */}
              <Route path="/admin" element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              } />
              
              {/* Route admin restaurant sans ID - redirige automatiquement */}
              <Route path="/admin-restaurant" element={
                <ProtectedRoute>
                  <RestaurantAdmin />
                </ProtectedRoute>
              } />
              
              <Route path="/admin-restaurant/:id" element={
                <ProtectedRoute>
                  <RestaurantAdmin />
                </ProtectedRoute>
              } />
              
              <Route path="/superadmin" element={
                <ProtectedRoute adminOnly={true}>
                  <SuperAdmin />
                </ProtectedRoute>
              } />
              
              <Route path="/quartieradmin" element={
                <ProtectedRoute>
                  <QuartiersAdmin />
                </ProtectedRoute>
              } />
              {/* Ambassadeur */}
              <Route path="/ambassador" element={
                <ProtectedRoute>
                  <AmbassadorDashboard />
                </ProtectedRoute>
              } />
              
              {/* Gestionnaire des Approvisionnements */}
              <Route path="/supply-manager" element={
                <ProtectedRoute>
                  <SupplyManagerDashboard />
                </ProtectedRoute>
              } />
              
              {/* Page d'information livraison */}
              <Route path="/delivery-info" element={
                <Suspense fallback={<div>Chargement...</div>}>
                  <DeliveryInfo />
                </Suspense>
              } />
              
              {/* Livreur - Login */}
              <Route path="/login-livreur" element={
                <Suspense fallback={<div>Chargement...</div>}>
                  <DeliveryPersonLogin />
                </Suspense>
              } />
              
              {/* Livreur - Interface mobile */}
              <Route path="/delivery-person" element={
                <Suspense fallback={<div>Chargement...</div>}>
                  <DeliveryPersonApp />
                </Suspense>
              } />
              
              {/* Confirmation de livraison par le client */}
              <Route path="/confirm-delivery/:orderId" element={
                <Suspense fallback={<div>Chargement...</div>}>
                  <ConfirmDelivery />
                </Suspense>
              } />
              
              {/* Gestionnaire de Livraison - Interface mobile */}
              <Route path="/delivery-manager" element={
                <ProtectedRoute>
                  <DeliveryManagerMobile />
                </ProtectedRoute>
              } />
              
              {/* Routes publiques */}
              <Route path="/details/:id" element={<ProductDetails />} />
              <Route path="/panier" element={<Panier />} />
              <Route path="/addrestaurant" element={<AddRestaurant />} />
              <Route path="/loginrestau" element={<Login />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/detail/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/order-details" element={<OrderAddress />} />
              <Route path="/categories/:category" element={<CategoryListing />} />
              <Route path="/order-status" element={<FinalOrderStatus />} />
              <Route path="/csv-demo" element={<CsvDemo />} />
              <Route path="/historique-commandes" element={
                <ProtectedRoute adminOnly={true}>
                  <HistoriqueCommandes />
                </ProtectedRoute>
              } />
              <Route path="/sales-history" element={
                <ProtectedRoute adminOnly={true}>
                  <SalesHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/employer" element={
                <ProtectedRoute adminOnly={true}>
                  <EmployeeManager />
                </ProtectedRoute>
              } />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/menus/:id" element={<MenuPage />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/failure" element={<PaymentFailure />} />
              <Route path="/complete_order/:orderId" element={<CompleteOrderPage />} />
              <Route path="/me/:numeroTelephoneClient/pay" element={<PayRedirect />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/maj" element={
                <ProtectedRoute adminOnly={true}>
                  <ChangerId />
                </ProtectedRoute>
              } />
              <Route path="/me/:numeroTelephoneClient/track" element={<TrackRedirect />} />
              <Route path="/track/:phone" element={<TrackRedirect />} />
              <Route path="/complete_order/phone/:phone" element={<TrackRedirect />} />
              <Route path="/thank-you/:orderId" element={<ThankYouPage />} />
              
              {/* Route pour accès non autorisé */}
              <Route path="/unauthorized" element={
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <h2>Accès non autorisé</h2>
                  <p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
                </div>
              } />
              
              {/* Redirection pour les routes inconnues */}
              <Route path="*" element={
                <div>
                  {console.log("❌ Route not found, redirecting to home. Current path:", window.location.pathname)}
                  <Navigate to="/" replace />
                </div>
              } />
            </Routes>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </HelmetProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;