import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  // Fonction pour générer une clé unique pour un article avec ses options
  const generateItemKey = (item) => {
    const extrasKey = item.selectedExtras ? JSON.stringify(item.selectedExtras) : '';
    const sizeKey = item.selectedSize || '';
    return `${item.id}-${extrasKey}-${sizeKey}`;
  };

  const addToCart = (item) => {
    setCartItems((prevItems) => {
      const itemKey = generateItemKey(item);
      const existing = prevItems.find((cartItem) => generateItemKey(cartItem) === itemKey);
      
      if (existing) {
        return prevItems.map((cartItem) =>
          generateItemKey(cartItem) === itemKey
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevItems, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== itemId)
    );
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l\'intérieur d\'un CartProvider');
  }
  return context;
};