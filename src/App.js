import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/cartcontext";
// Global styles
import '@fortawesome/fontawesome-free/css/all.min.css';

// Lazy-loaded pages (route-based code splitting)
const Admin = lazy(() => import('./pages/Admin'));
const Accueil = lazy(() => import('./pages/acceuil'));
const Panier = lazy(() => import('./pages/panier'));
const AddRestaurant = lazy(() => import('./pages/Addrestaurants'));
const RestaurantAdmin = lazy(() => import('./pages/restaurantadmin'));
const Login = lazy(() => import('./pages/loginrestau'));
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

function App() {
  return (
    <CartProvider>
      <Router>
        <Suspense fallback={<div style={{ padding: 16 }}>Chargement...</div>}>
          <Routes>
          <Route path="/" element={<Logins />} />
          <Route path="/accueil" element={<Accueil />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/details/:id" element={<ProductDetails />} />
          <Route path="/panier" element={<Panier />} />
          <Route path="/addrestaurant" element={<AddRestaurant />} />
          <Route path="/admin-restaurant/:id" element={<RestaurantAdmin />} />
          <Route path="/loginrestau" element={<Login />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/detail/:id" element={<ProductDetails />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/order-details" element={<OrderAddress />} />
          <Route path="/category/:id" element={<CategoryListing />} />
          <Route path="/complete_order" element={<FinalOrderStatus />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/quartiersadmin" element={<QuartiersAdmin />} />
          <Route path="/employer" element={<EmployeeManager />} />
          <Route path="/thank-you/:orderId" element={<ThankYouPage />} />
          <Route path="/menu/:id" element={<MenuPage />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/failure" element={<PaymentFailure />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/mainto" element={<MaintenancePage />} />
          <Route path="/changer-id" element={<ChangerId />} />
          <Route path="/commande/me/:numeroTelephoneClient" element={<OrderTracking />} />

          {/* <Route path="*" element={<NotFoundPage />} /> */}
          </Routes>
        </Suspense>
      </Router>
    </CartProvider>
  );
}

export default App;