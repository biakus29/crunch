import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc,query,where } from "firebase/firestore";

// Générer un slug à partir du nom
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// Vérifier l'unicité du slug
const checkSlugUniqueness = async (slug, excludeId) => {
  const itemsRef = collection(db, "items");
  const q = query(itemsRef, where("slug", "==", slug));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.every((doc) => doc.id === excludeId);
};

// Mettre à jour les articles
const migrateSlugs = async () => {
  try {
    const itemsRef = collection(db, "items");
    const snapshot = await getDocs(itemsRef);
    let updatedCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.name) {
        console.warn(`Produit ${docSnap.id} sans nom, ignoré.`);
        continue;
      }

      let slug = generateSlug(data.name);
      let isUnique = await checkSlugUniqueness(slug, docSnap.id);

      // Si le slug existe déjà, ajouter un suffixe
      let suffix = 1;
      while (!isUnique) {
        slug = `${generateSlug(data.name)}-${suffix}`;
        isUnique = await checkSlugUniqueness(slug, docSnap.id);
        suffix++;
      }

      if (!data.slug || data.slug !== slug) {
        await updateDoc(doc(db, "items", docSnap.id), { slug });
        console.log(`Mise à jour du slug pour ${data.name}: ${slug}`);
        updatedCount++;
      }
    }

    console.log(`Migration terminée : ${updatedCount} articles mis à jour.`);
  } catch (error) {
    console.error("Erreur lors de la migration des slugs :", error);
  }
};

migrateSlugs();