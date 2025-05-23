import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase"; // Assurez-vous que Firebase est configuré
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, Timestamp, getDocs } from "firebase/firestore";

const EmployeeManagerPage = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: "", role: "cuisinier", email: "" });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentRestaurantId, setCurrentRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Récupérer le restaurantId à partir de l'utilisateur authentifié
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const restaurantQuery = query(
            collection(db, "restaurants"),
            where("uid", "==", user.uid)
          );
          const restaurantSnapshot = await getDocs(restaurantQuery);
          if (!restaurantSnapshot.empty) {
            const restaurantDoc = restaurantSnapshot.docs[0];
            setCurrentRestaurantId(restaurantDoc.id);
          } else {
            setError("Aucun restaurant trouvé pour cet utilisateur");
          }
        } catch (error) {
          console.error("Erreur lors de la récupération du restaurant:", error);
          setError("Erreur lors de la récupération du restaurant");
        }
      } else {
        setError("Utilisateur non authentifié");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Charger les employés
  useEffect(() => {
    if (!currentRestaurantId) return;

    const employeesQuery = query(
      collection(db, "employees"),
      where("restaurantId", "==", currentRestaurantId)
    );
    const unsubscribe = onSnapshot(
      employeesQuery,
      (snapshot) => {
        const employeesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEmployees(employeesData);
      },
      (error) => {
        console.error("Erreur lors de la récupération des employés:", error);
        setError("Erreur lors de la récupération des employés");
      }
    );
    return () => unsubscribe();
  }, [currentRestaurantId]);

  // Réinitialiser les messages d'erreur et de succès après 3 secondes
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Créer un nouvel employé
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.name.trim()) {
      setError("Le nom est requis");
      return;
    }

    try {
      const employeeRef = doc(collection(db, "employees"));
      await setDoc(employeeRef, {
        name: newEmployee.name.trim(),
        role: newEmployee.role,
        email: newEmployee.email.trim() || "",
        restaurantId: currentRestaurantId,
        createdAt: Timestamp.now(),
      });
      setSuccess("Employé ajouté avec succès !");
      setNewEmployee({ name: "", role: "cuisinier", email: "" });
    } catch (error) {
      console.error("Erreur lors de la création de l'employé:", error);
      setError("Erreur lors de la création de l'employé");
    }
  };

  // Mettre à jour un employé
  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    if (!editingEmployee.name.trim()) {
      setError("Le nom est requis");
      return;
    }

    try {
      const employeeRef = doc(db, "employees", editingEmployee.id);
      await updateDoc(employeeRef, {
        name: editingEmployee.name.trim(),
        role: editingEmployee.role,
        email: editingEmployee.email.trim() || "",
        updatedAt: Timestamp.now(),
      });
      setSuccess("Employé mis à jour avec succès !");
      setEditingEmployee(null);
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'employé:", error);
      setError("Erreur lors de la mise à jour de l'employé");
    }
  };

  // Supprimer un employé
  const handleDeleteEmployee = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cet employé ?")) {
      try {
        const employeeRef = doc(db, "employees", id);
        await deleteDoc(employeeRef);
        setSuccess("Employé supprimé avec succès !");
      } catch (error) {
        console.error("Erreur lors de la suppression de l'employé:", error);
        setError("Erreur lors de la suppression de l'employé");
      }
    }
  };

  // Démarrer l'édition d'un employé
  const startEditing = (employee) => {
    setEditingEmployee({ ...employee });
  };

  // Annuler l'édition
  const cancelEditing = () => {
    setEditingEmployee(null);
  };

  if (loading) {
    return <div className="container-fluid p-4">Chargement...</div>;
  }

  return (
    <div className="container-fluid p-4">
      <h1 className="text-xl font-semibold mb-4">Gestion des Employés</h1>

      {/* Messages d'erreur et de succès */}
      {error && <div className="alert alert-danger text-xs mb-4">{error}</div>}
      {success && <div className="alert alert-success text-xs mb-4">{success}</div>}

      <div className="bg-white rounded-lg shadow-lg p-4">
        {/* Formulaire pour ajouter un nouvel employé */}
        <div className="mb-6">
          <h2 className="text-sm font-medium mb-2">Ajouter un employé</h2>
          <form onSubmit={handleCreateEmployee} className="space-y-3">
            <div>
              <label className="block text-xs font-medium">Nom</label>
              <input
                type="text"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                className="w-full p-2 border rounded text-xs"
                placeholder="Entrez le nom"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium">Rôle</label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                className="w-full p-2 border rounded text-xs"
              >
                <option value="cuisinier">Cuisinier</option>
                <option value="livreur">Livreur</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium">Email (optionnel)</label>
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                className="w-full p-2 border rounded text-xs"
                placeholder="Entrez l'email"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 text-xs"
              disabled={!currentRestaurantId}
            >
              Ajouter
            </button>
          </form>
        </div>

        {/* Formulaire pour modifier un employé */}
        {editingEmployee && (
          <div className="mb-6">
            <h2 className="text-sm font-medium mb-2">Modifier l'employé</h2>
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <div>
                <label className="block text-xs font-medium">Nom</label>
                <input
                  type="text"
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full p-2 border rounded text-xs"
                  placeholder="Entrez le nom"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium">Rôle</label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  className="w-full p-2 border rounded text-xs"
                >
                  <option value="cuisinier">Cuisinier</option>
                  <option value="livreur">Livreur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium">Email (optionnel)</label>
                <input
                  type="email"
                  value={editingEmployee.email}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className="w-full p-2 border rounded text-xs"
                  placeholder="Entrez l'email"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-xs"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="flex-1 bg-gray-200 p-2 rounded hover:bg-gray-300 text-xs"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tableau des employés */}
        <div>
          <h2 className="text-sm font-medium mb-2">Liste des employés</h2>
          {employees.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun employé trouvé</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Rôle</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b">
                      <td className="p-2">{employee.name}</td>
                      <td className="p-2">{employee.role === "cuisinier" ? "Cuisinier" : "Livreur"}</td>
                      <td className="p-2">{employee.email || "N/A"}</td>
                      <td className="p-2">
                        <button
                          onClick={() => startEditing(employee)}
                          className="text-blue-600 hover:text-blue-800 mr-2"
                          title="Modifier"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Supprimer"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeManagerPage;