import React, { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

// Composant réutilisable pour les champs de saisie
const InputField = ({ label, name, value, onChange, error, placeholder, type = "text", disabled = false }) => (
  <div className="mb-3">
    <label className="block text-gray-700">
      {label} <span className="text-red-500">*</span>
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full p-2 border rounded ${error ? "border-red-500" : "border-gray-300"}`}
      placeholder={placeholder}
      required
      disabled={disabled}
    />
    {error && <p className="text-red-500 text-sm">{error}</p>}
  </div>
);

// Composant principal
const QuartiersAdmin = () => {
  const [quartiers, setQuartiers] = useState([]);
  const [quartierData, setQuartierData] = useState({ id: "", name: "", fee: "" });
  const [editingQuartier, setEditingQuartier] = useState(null);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Charger les quartiers depuis Firestore
  useEffect(() => {
    const fetchQuartiers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "quartiers"));
        const quartiersList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setQuartiers(quartiersList);
      } catch (error) {
        setActionError("Erreur lors du chargement des quartiers.");
      }
    };
    fetchQuartiers();
  }, []);

  // Validation des données
  const validateQuartierData = (data) => {
    const newErrors = {};
    if (!data.id) newErrors.id = "ID requis";
    if (!data.name) newErrors.name = "Nom requis";
    if (!data.fee) newErrors.fee = "Frais requis";
    else if (isNaN(data.fee) || data.fee <= 0) newErrors.fee = "Frais doivent être un nombre positif";
    return newErrors;
  };

  // Gestion des changements d'entrée
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuartierData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    if (actionError) setActionError("");
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateQuartierData(quartierData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      if (editingQuartier) {
        // Mise à jour
        await updateDoc(doc(db, "quartiers", editingQuartier.id), {
          name: quartierData.name,
          fee: parseInt(quartierData.fee),
        });
      } else {
        // Ajout
        const existingQuartier = quartiers.find((q) => q.id === quartierData.id);
        if (existingQuartier) {
          setErrors({ id: "Cet ID existe déjà" });
          setLoading(false);
          return;
        }
        await addDoc(collection(db, "quartiers"), {
          id: quartierData.id,
          name: quartierData.name,
          fee: parseInt(quartierData.fee),
        });
      }
      const snapshot = await getDocs(collection(db, "quartiers"));
      setQuartiers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setShowModal(false);
      resetForm();
    } catch (error) {
      setActionError("Erreur lors de l'enregistrement du quartier.");
    }
    setLoading(false);
  };

  // Suppression d'un quartier
  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce quartier ?")) {
      try {
        await deleteDoc(doc(db, "quartiers", id));
        setQuartiers(quartiers.filter((q) => q.id !== id));
      } catch (error) {
        setActionError("Erreur lors de la suppression.");
      }
    }
  };

  // Modification d'un quartier
  const handleEdit = (quartier) => {
    setQuartierData({ id: quartier.id, name: quartier.name, fee: quartier.fee });
    setEditingQuartier(quartier);
    setShowModal(true);
  };

  // Réinitialisation du formulaire
  const resetForm = () => {
    setQuartierData({ id: "", name: "", fee: "" });
    setEditingQuartier(null);
    setErrors({});
    setActionError("");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Gestion des Quartiers</h1>

        {actionError && (
          <div className="mb-4 bg-red-100 text-red-700 p-2 rounded">{actionError}</div>
        )}

        {/* Bouton pour ajouter un quartier */}
        <div className="mb-6">
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Ajouter un quartier
          </button>
        </div>

        {/* Liste des quartiers */}
        <div className="grid gap-4">
          {quartiers.map((quartier) => (
            <div
              key={quartier.id}
              className="flex justify-between items-center p-4 bg-white shadow rounded-lg"
            >
              <div>
                <p className="font-semibold">{quartier.name}</p>
                <p className="text-gray-600">ID: {quartier.id}</p>
                <p className="text-gray-600">Frais: {quartier.fee} FCFA</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(quartier)}
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(quartier.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modale pour ajouter/modifier un quartier */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-md">
              <div className="p-4 border-b flex justify-between items-center">
                <h5 className="font-semibold">
                  {editingQuartier ? "Modifier le quartier" : "Nouveau quartier"}
                </h5>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <InputField
                  label="ID"
                  name="id"
                  value={quartierData.id}
                  onChange={handleInputChange}
                  error={errors.id}
                  placeholder="Ex: quartier44"
                  disabled={!!editingQuartier}
                />
                <InputField
                  label="Nom"
                  name="name"
                  value={quartierData.name}
                  onChange={handleInputChange}
                  error={errors.name}
                  placeholder="Ex: Odza happy"
                />
                <InputField
                  label="Frais (FCFA)"
                  name="fee"
                  value={quartierData.fee}
                  onChange={handleInputChange}
                  error={errors.fee}
                  placeholder="Ex: 1000"
                  type="number"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 p-2 bg-gray-100 rounded"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-2 bg-green-600 text-white rounded flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <i className="fa-solid fa-spinner animate-spin mr-2"></i>
                    ) : editingQuartier ? (
                      "Mettre à jour"
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuartiersAdmin;