import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/detail.css"; // Import du fichier CSS

const Detail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [selectedSupplement, setSelectedSupplement] = useState(null);
  const [quantity, setQuantity] = useState(1); // Compteur de pièces

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const crunchRef = doc(db, "crunch", id);
        const mangeDabordRef = doc(db, "mange_dabord", id);

        let docSnap = await getDoc(crunchRef);
        if (!docSnap.exists()) {
          docSnap = await getDoc(mangeDabordRef);
        }

        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.error("Produit introuvable !");
        }
      } catch (error) {
        console.error("Erreur de récupération du produit :", error);
      }
    };

    fetchProduct();
  }, [id]);

  if (!product) {
    return <p className="text-center mt-5">Chargement...</p>;
  }

  // Déterminer les suppléments possibles
  const supplements =
    product.jour !== undefined
      ? ["Bâton de manioc", "Manioc"]
      : ["Frites de pommes", "Frites de plantain"];

  // Fonction pour ajouter au panier
  const addToCart = () => {
    if (!selectedSupplement) {
      alert("Veuillez choisir un supplément avant d'ajouter au panier.");
      return;
    }

    const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

    const existingItemIndex = cartItems.findIndex(
      (item) => item.id === product.id && item.supplement === selectedSupplement
    );

    if (existingItemIndex !== -1) {
      cartItems[existingItemIndex].quantite += quantity;
    } else {
      cartItems.push({
        id: product.id,
        nom: product.nom,
        prix: product.prix,
        image: product.image,
        description: product.description,
        quantite: quantity,
        supplement: selectedSupplement,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cartItems));
    navigate("/panier");
  };

  return (
    <div className="container detail-container">
      <button className="btn btn-link" onClick={() => navigate(-1)}>
        ← Retour
      </button>

      <div className="card my-4 shadow">
        <div className="row g-0">
          <div className="col-md-6">
            <img
              src={product.image}
              alt={product.nom}
              className="img-fluid rounded-start"
            />
          </div>
          <div className="col-md-6">
            <div className="card-body">
              <h2 className="card-title text-center">{product.nom}</h2>
              <p className="card-text text-muted text-center">{product.description}</p>
              <h4 className="text-success text-center">{product.prix} FCFA</h4>

              {/* Sélection du Nombre de Pièces */}
              <div className="quantity-selector text-center my-3">
                <h6>Quantité :</h6>
                <div className="btn-group" role="group">
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </button>
                  <span className="mx-2">{quantity}</span>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Sélection des Suppléments */}
              <div className="supplements text-center my-3">
                <h6>Choisissez un supplément :</h6>
                <div className="d-flex justify-content-center gap-3">
                  {supplements.map((sup, index) => (
                    <button
                      key={index}
                      className={`btn ${selectedSupplement === sup ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setSelectedSupplement(sup)}
                    >
                      {sup}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bouton Ajouter au Panier */}
              <button className="btn btn-success w-100 mt-3" onClick={addToCart}>
                Ajouter {quantity} {quantity > 1 ? "pièces" : "pièce"} au panier
                {selectedSupplement && ` (+ ${selectedSupplement})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detail;
