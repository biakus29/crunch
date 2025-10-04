import React from "react";
import { FaBars, FaBell, FaUser, FaChevronDown } from "react-icons/fa";

const Topbar = ({ restaurantName, activeSectionLabel, onToggleMobile, onCreateOrder, showCreateOrderButton = false }) => {
  return (
    <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center">
        <button onClick={onToggleMobile} className="text-gray-600 mr-4 md:hidden">
          <FaBars className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">{activeSectionLabel || "Tableau de bord"}</h1>
      </div>

      <div className="flex items-center space-x-4">
        {showCreateOrderButton && (
          <button
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors hidden sm:inline-flex items-center"
            onClick={() => {
              if (typeof onCreateOrder === "function") {
                onCreateOrder();
              }
              try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (_) {}
            }}
            title="Aller à Créer une commande"
          >
            <i className="fas fa-plus mr-2" />
            Créer une commande
          </button>
        )}
        <button className="relative p-1 text-gray-500 hover:text-gray-700">
          <FaBell className="w-5 h-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="hidden md:flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <FaUser className="text-green-600" />
          </div>
          <span className="font-medium text-sm">{restaurantName || "Admin"}</span>
          <FaChevronDown className="text-gray-400 text-xs" />
        </div>
      </div>
    </header>
  );
};

export default Topbar;
