import React from 'react';
import { useLocation } from 'react-router-dom';
import PartnerDashboard from '../components/admin/partners/PartnerDashboard';
import { useAuth } from '../context/authcontext';

const PartnerDeliveriesPage = () => {
  const location = useLocation();
  const { state } = location || {};
  const { user } = useAuth();

  // Prefer state passed during navigation, fallback to user data from auth context
  const currentRestaurantId = state?.restaurantId || user?.restaurantId || null;
  const userRole = state?.userRole || user?.role || (user ? user.role : null) || null;

  return <PartnerDashboard currentRestaurantId={currentRestaurantId} userRole={userRole} />;
};

export default PartnerDeliveriesPage;
