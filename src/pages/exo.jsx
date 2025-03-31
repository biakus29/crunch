import { db } from "../firebase";
import { setDoc, doc } from "firebase/firestore";
import { useEffect } from "react";

// Liste complète des nouveaux quartiers extraits des images
const nouveauxQuartiersBruts = [
 
    { id: "abom", name: "Abom", fee: 2000 },
    { id: "afanoya", name: "Afanoya", fee: 2000 },
    { id: "ahala", name: "Ahala", fee: 1500 },
    { id: "awae", name: "Awae", fee: 1500 },
    { id: "awaeCarriere", name: "Awae Carrière", fee: 2000 },
    { id: "barriviere", name: "Barrivière", fee: 1000 },
    { id: "bastos", name: "Bastos", fee: 1000 },
    { id: "biteng", name: "Biteng", fee: 1500 },
    { id: "biyemAssi", name: "Biyem-Assi", fee: 1000 },
    { id: "carrefourAmitie", name: "Carrefour de l'Amitié", fee: 1000 },
    { id: "carrefourMEEC", name: "Carrefour MEEC", fee: 1000 },
    { id: "citeVerte", name: "Cité Verte", fee: 1000 },
    { id: "dakar", name: "Dakar", fee: 1000 },
    { id: "damas", name: "Damas", fee: 1000 },
    { id: "ecolePolice", name: "École de Police", fee: 1000 },
    { id: "efoulan", name: "Efoulan", fee: 1000 },
    { id: "ekie", name: "Ekie", fee: 1500 },
    { id: "ekoudou", name: "Ekoudou", fee: 1000 },
    { id: "ekoumdoum", name: "Ekoumdoum", fee: 1000 },
    { id: "ekounou", name: "Ekounou", fee: 1000 },
    { id: "eleveur", name: "Éleveur", fee: 1500 },
    { id: "eligEdzoa", name: "Elig-Edzoa", fee: 1000 },
    { id: "eligEffa", name: "Elig-Effa", fee: 1000 },
    { id: "eligEssono", name: "Elig-Essono", fee: 1000 },
    { id: "emana", name: "Emana", fee: 1000 },
    { id: "emombo", name: "Emombo", fee: 1000 },
    { id: "essos", name: "Essos", fee: 1000 },
    { id: "etamBafia", name: "Etam-Bafia", fee: 1000 },
    { id: "etetak", name: "Etetak", fee: 1000 },
    { id: "etoa", name: "Etoa", fee: 1000 },
    { id: "etoaMeki", name: "Etoa-Meki", fee: 1000 },
    { id: "etoudi", name: "Etoudi", fee: 1000 },
    { id: "etougEbe", name: "Etoug-Ebe", fee: 1000 },
    { id: "febe", name: "Febe", fee: 1500 },
    { id: "grandMessa", name: "Grand-Messa", fee: 1000 },
    { id: "kondengui", name: "Kondengui", fee: 1000 },
    { id: "madagascar", name: "Madagascar", fee: 1000 },
    { id: "manguier", name: "Manguier", fee: 1000 },
    { id: "mballa2", name: "Mballa 2", fee: 1000 },
    { id: "mbankolo", name: "Mbankolo", fee: 2000 },
    { id: "mebandan", name: "Mebandan", fee: 2000 },
    { id: "mekoumbou", name: "Mekoumbou", fee: 2000 },
    { id: "melen", name: "Melen", fee: 1000 },
    { id: "mendongMarcheBanana", name: "Mendong Marché/Banana", fee: 1000 },
    { id: "mendongSimbok", name: "Mendong Simbok", fee: 1000 },
    { id: "mendongAutre", name: "Mendong Autre", fee: 1000 },
    { id: "messaCarriere", name: "Messa Carrière", fee: 1000 },
    { id: "messassi", name: "Messassi", fee: 1500 },
    { id: "mimboman", name: "Mimboman", fee: 1000 },
    { id: "minkan", name: "Minkan", fee: 2000 },
    { id: "minkoameyos", name: "Minkoameyos", fee: 1000 },
    { id: "mokolo", name: "Mokolo", fee: 1000 },
    { id: "mvan", name: "Mvan", fee: 1000 },
    { id: "mvogAda", name: "Mvog Ada", fee: 1000 },
    { id: "mvogBetsi", name: "Mvog Betsi", fee: 1000 },
    { id: "mvogMbi", name: "Mvog Mbi", fee: 1000 },
    { id: "mvolye", name: "Mvolye", fee: 1000 },
    { id: "ndamvout", name: "Ndamvout", fee: 1000 },
    { id: "ngoaEkele", name: "Ngoa-Ekele", fee: 1000 },
    { id: "ngoulmekong", name: "Ngoulmekong", fee: 1500 },
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
