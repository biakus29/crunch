import { 
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Map Firestore doc to UI-friendly object (with normalized dates)
function mapPromotionDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    startDate: data.startDate?.toDate?.()?.toISOString().slice(0, 16) || data.startDate,
    endDate: data.endDate?.toDate?.()?.toISOString().slice(0, 16) || data.endDate,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  };
}

export async function getPromotionsByRestaurant(restaurantId) {
  if (!restaurantId) return [];
  const q = query(collection(db, 'promotions'), where('restaurantId', '==', restaurantId));
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapPromotionDoc);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return items;
}

export async function createPromotion(promotionData) {
  const docRef = await addDoc(collection(db, 'promotions'), promotionData);
  return docRef.id;
}

export async function updatePromotion(promotionId, data) {
  await updateDoc(doc(db, 'promotions', promotionId), data);
}

export async function deletePromotionById(promotionId) {
  await deleteDoc(doc(db, 'promotions', promotionId));
}

export async function setPromotionStatus(promotionId, isActive) {
  await updateDoc(doc(db, 'promotions', promotionId), {
    isActive,
    updatedAt: Timestamp.now(),
  });
}
