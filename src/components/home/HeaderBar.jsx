import React, { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Grid, Search } from 'lucide-react';
import logo from '../../image/logo.png';
import { AnimatedComponents, ANIMATION_VARIANTS } from '../../utils/animationSystem';
const PointsBadge = lazy(() => import('../PointsBadge'));

const HeaderBar = ({ notifications = [], searchQuery = '', onSearchChange, onOpenNotifications }) => {
  return (
    <motion.header 
      {...ANIMATION_VARIANTS.fadeInDown}
      className="bg-white border-b p-3 transition-all duration-300"
    >
      <div className="flex items-center">
        <Link to="/accueil" className="flex items-center no-underline text-black">
          <AnimatedComponents.AnimatedImage
            src={logo}
            alt="logo"
            className="h-8 mr-2"
            hoverZoom={false}
          />
          <h4 className="font-bold text-green-600 m-0">MANGE d'ABORD</h4>
        </Link>
        <div className="ml-auto flex items-center space-x-3">
          <Suspense fallback={<div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />}> 
            <PointsBadge />
          </Suspense>
          <motion.button
            {...ANIMATION_VARIANTS.buttonPress}
            onClick={onOpenNotifications}
            className="bg-white p-1 rounded shadow-sm flex items-center hover:bg-gray-100 transition-colors duration-200"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {notifications.length > 0 && (
              <motion.span 
                {...ANIMATION_VARIANTS.scaleIn}
                className="bg-red-600 text-white text-xs px-1 rounded-full ml-1 animate-pulse"
              >
                {notifications.filter(n => !n.read).length}
              </motion.span>
            )}
          </motion.button>
          <Link to="#" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
            <Grid className="w-5 h-5" />
          </Link>
        </div>
      </div>
      <div className="mt-3 rounded shadow-sm overflow-hidden bg-white flex transition-all duration-300 focus-within:ring-2 focus-within:ring-green-500">
        <button className="bg-white p-2 border-0 text-green-600">
          <Search className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={searchQuery}
          onChange={onSearchChange}
          className="flex-1 p-2 border-0 focus:outline-none"
          placeholder="Rechercher des plats ou restaurants..."
        />
      </div>
    </motion.header>
  );
};

export default HeaderBar;
