import { db } from "../firebase";
import { setDoc, doc } from "firebase/firestore";
import { useEffect } from "react";

// Liste complète des nouveaux quartiers extraits des images
const nouveauxQuartiersBruts = [
  { id: "mendongMarcheBanana", name: "Mendong Marché/Banana", fee: 500 },
  { id: "mendongSimbok", name: "Mendong Simbok", fee: 500 },
  { id: "mendongAutre", name: "Mendong Autre", fee: 0 },
  { id: "messaCarriere", name: "Messa Carrière", fee: 500 },
  { id: "mimboman", name: "Mimboman", fee: 500 },
  { id: "minkan", name: "Minkan", fee: 500 },
  { id: "nkolbikok", name: "Nkolbikok", fee: 500 },
  { id: "nkolbisson", name: "Nkolbisson", fee: 0 },
  { id: "nkomkana", name: "Nkomkana", fee: 500 },
  { id: "nsimeyong", name: "Nsimeyong", fee: 500 },
  { id: "mvogAda", name: "Mvog Ada", fee: 500 },
  { id: "mvan", name: "Mvan", fee: 500 },
  { id: "nsam", name: "Nsam", fee: 0 },
  { id: "nsamMinkio", name: "Nsam Minkio", fee: 500 },
  // Si d'autres nouveaux quartiers sont extraits des images, ajoutez-les ici
];

// Normalisation : tous les tarifs inférieurs à 1000 (0 ou 500) deviennent 1000
const nouveauxQuartiersNormalises = nouveauxQuartiersBruts.map((quartier) => ({
  ...quartier,
  fee: quartier.fee < 1000 ? 1000 : quartier.fee,
}));

const AddNouveauxQuartiers = () => {
  useEffect(() => {
    const addQuartiersToFirestore = async () => {
      try {
        // Pour chaque nouveau quartier, on crée ou écrase le document dans la collection "quartiers"
        const batch = nouveauxQuartiersNormalises.map((quartier) =>
          setDoc(doc(db, "quartiers", quartier.id), quartier)
        );
        // On attend que toutes les écritures soient terminées
        await Promise.all(batch);
        console.log("Tous les nouveaux quartiers ont été ajoutés avec succès.");
      } catch (error) {
        console.error("Erreur lors de l'ajout des nouveaux quartiers :", error);
      }
    };

    addQuartiersToFirestore();
  }, []);

  return <div>Ajout de tous les nouveaux quartiers en cours...</div>;
};

export default AddNouveauxQuartiers;
