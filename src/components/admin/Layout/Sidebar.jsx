import React from "react";
import { FaBars, FaTimes, FaUser } from "react-icons/fa";
import { HiOutlineLogout } from "react-icons/hi";

const Sidebar = ({
  sidebarOpen,
  setSidebarOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
  activeSection,
  setActiveSection,
  menuItems,
  restaurantName,
  onSignOut,
}) => {
  return (
    <div
      className={`bg-gradient-to-b from-green-700 to-green-800 text-white transition-all duration-300 fixed md:relative z-30 h-full 
      ${sidebarOpen ? "w-64" : "w-20"} ${mobileMenuOpen ? "block" : "hidden md:block"}`}
    >
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between border-b border-green-600 h-16">
        {sidebarOpen && (
          <div className="flex items-center">
            <h1 className="text-xl font-bold">{restaurantName || "Restaurant"}</h1>
          </div>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 rounded-full hover:bg-green-600 transition-colors"
        >
          {sidebarOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
        </button>
      </div>

      {/* User Profile Mini */}
      {sidebarOpen && (
        <div className="p-4 border-b border-green-600 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <FaUser className="text-green-600" />
          </div>
          <div className="flex-1 truncate">
            <p className="font-medium truncate">{restaurantName || "Admin"}</p>
            <p className="text-xs text-green-200 truncate">Restaurant Manager</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 px-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveSection(item.id);
              setMobileMenuOpen(false);
            }}
            className={`flex items-center w-full p-3 rounded-lg mb-1 text-left transition-colors ${
              activeSection === item.id ? "bg-white text-green-700 font-medium" : "text-white hover:bg-green-600"
            }`}
          >
            <span className="flex items-center">
              <span className={`${sidebarOpen ? "mr-3" : "mx-auto"}`}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </span>
            {sidebarOpen && activeSection === item.id && (
              <span className="ml-auto bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Actif</span>
            )}
          </button>
        ))}
      </nav>

      {/* Sidebar Footer */}
      {sidebarOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-green-600">
          <button
            className="flex items-center w-full p-2 text-white hover:bg-green-600 rounded-lg transition-colors"
            onClick={onSignOut}
          >
            <HiOutlineLogout className="mr-3" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
