import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Admin from "./pages/Admin";
import Accueil from "./pages/acceuil";
import Detail from "./pages/Details";
import Panier from "./pages/panier";
import AddRestaurant from "./pages/Addrestaurants";
import RestaurantAdmin from "./pages/restaurantadmin";
import Login from "./pages/loginrestau";
import OrdersPage from "./pages/oders";
import ProductDetails from "./pages/detail";
import { CartProvider } from "./context/cartcontext";
import CartPage from "./pages/panier";
import OrderAddress from "./pages/oderdetails";
import '@fortawesome/fontawesome-free/css/all.min.css';
import CategoryListing from "./pages/categorieslist";
import FinalOrderStatus from "./pages/ordersstatuts";
import RemplacerRestaurantId from "./pages/exo";


function App() {
  return (
    <CartProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Accueil />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/details/:id" element={<Detail />} />
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
                    {/* Nouvelle route pour la mise à jour de l'ID */}
          <Route path="/update-restaurant-id" element={<RemplacerRestaurantId />} />

        </Routes>
      </Router>
    </CartProvider>
  );
}

export default App;
