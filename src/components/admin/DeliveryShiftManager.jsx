import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  FaClock,
  FaSignInAlt,
  FaSignOutAlt,
  FaCalendarAlt,
  FaUser,
  FaHistory,
  FaCheckCircle,
  FaTimesCircle,
} from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DeliveryShiftManager = ({ currentRestaurantId }) => {
  const [deliverers, setDeliverers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeShifts, setActiveShifts] = useState({});

  useEffect(() => {
    if (!currentRestaurantId) return;
    loadData();
  }, [currentRestaurantId, selectedDate]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les livreurs actifs
      const deliverersSnap = await getDocs(
        query(
          collection(db, 'deliverers'),
          where('restaurantId', '==', currentRestaurantId),
          where('active', '==', true)
        )
      );
      const deliverersData = deliverersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDeliverers(deliverersData);

      // Charger les shifts du jour sélectionné
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const shiftsSnap = await getDocs(
        query(
          collection(db, 'deliveryShifts'),
          where('restaurantId', '==', currentRestaurantId),
          where('date', '>=', Timestamp.fromDate(startOfDay)),
          where('date', '<=', Timestamp.fromDate(endOfDay))
        )
      );

      const shiftsData = shiftsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setShifts(shiftsData);

      // Identifier les shifts actifs (pas encore terminés)
      const activeShiftsMap = {};
      shiftsData.forEach((shift) => {
        if (!shift.endTime) {
          activeShiftsMap[shift.delivererId] = shift;
        }
      });
      setActiveShifts(activeShiftsMap);

      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
      setLoading(false);
    }
  };

  const handleClockIn = async (deliverer) => {
    try {
      const now = new Date();
      await addDoc(collection(db, 'deliveryShifts'), {
        delivererId: deliverer.id,
        delivererName: deliverer.name,
        restaurantId: currentRestaurantId,
        date: Timestamp.fromDate(now),
        startTime: Timestamp.fromDate(now),
        endTime: null,
        duration: null,
        createdAt: serverTimestamp(),
      });

      toast.success(`${deliverer.name} a commencé son service`);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleClockOut = async (deliverer) => {
    try {
      const shift = activeShifts[deliverer.id];
      if (!shift) {
        toast.error('Aucun service actif trouvé');
        return;
      }

      const now = new Date();
      const startTime = shift.startTime.toDate();
      const durationMinutes = Math.round((now - startTime) / 1000 / 60);

      await updateDoc(doc(db, 'deliveryShifts', shift.id), {
        endTime: Timestamp.fromDate(now),
        duration: durationMinutes,
        updatedAt: serverTimestamp(),
      });

      toast.success(`${deliverer.name} a terminé son service (${Math.floor(durationMinutes / 60)}h${durationMinutes % 60}min)`);
      loadData();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la fin de service');
    }
  };

  const getShiftForDeliverer = (delivererId) => {
    return shifts.find((s) => s.delivererId === delivererId);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return timestamp.toDate().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins}min`;
  };

  // Statistiques du jour
  const stats = {
    totalDeliverers: deliverers.length,
    activeNow: Object.keys(activeShifts).length,
    completedShifts: shifts.filter((s) => s.endTime).length,
    totalHours: shifts
      .filter((s) => s.duration)
      .reduce((sum, s) => sum + s.duration, 0) / 60,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header avec sélecteur de date */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <FaClock className="mr-3 text-blue-600" />
            Gestion des Horaires de Service
          </h3>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Date :</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Livreurs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDeliverers}</p>
            </div>
            <FaUser className="text-3xl text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">En Service</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeNow}</p>
            </div>
            <FaCheckCircle className="text-3xl text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Services Terminés</p>
              <p className="text-2xl font-bold text-purple-600">{stats.completedShifts}</p>
            </div>
            <FaHistory className="text-3xl text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Heures</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalHours.toFixed(1)}h</p>
            </div>
            <FaClock className="text-3xl text-orange-500" />
          </div>
        </div>
      </div>

      {/* Liste des livreurs avec actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-gray-800 flex items-center">
            <FaCalendarAlt className="mr-2 text-blue-600" />
            Présences du {new Date(selectedDate).toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Livreur
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Heure Début
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Heure Fin
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durée
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deliverers.map((deliverer) => {
                const shift = getShiftForDeliverer(deliverer.id);
                const isActive = activeShifts[deliverer.id];

                return (
                  <tr key={deliverer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <FaUser className="text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{deliverer.name}</p>
                          <p className="text-xs text-gray-500">{deliverer.zone || 'Toutes zones'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FaCheckCircle className="mr-1" />
                          En service
                        </span>
                      ) : shift ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <FaTimesCircle className="mr-1" />
                          Terminé
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pas encore arrivé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {shift ? formatTime(shift.startTime) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {shift ? formatTime(shift.endTime) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {shift ? formatDuration(shift.duration) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        {!isActive && !shift && (
                          <button
                            onClick={() => handleClockIn(deliverer)}
                            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition"
                          >
                            <FaSignInAlt className="mr-1" />
                            Arrivée
                          </button>
                        )}
                        {isActive && (
                          <button
                            onClick={() => handleClockOut(deliverer)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                          >
                            <FaSignOutAlt className="mr-1" />
                            Départ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deliverers.length === 0 && (
            <div className="text-center py-8">
              <FaUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">Aucun livreur actif</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryShiftManager;
