import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

// Script de test pour créer un paiement de test
export const createTestPayment = async () => {
  try {
    const testPayment = {
      orderId: 'test-order-' + Date.now(),
      transactionId: 'test-transaction-' + Date.now(),
      amount: 5000,
      currency: 'XOF',
      method: 'mobile_money',
      status: 'pending',
      customerEmail: 'test@example.com',
      description: 'Paiement de test',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'payments'), testPayment);

    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de la création du paiement de test:', error);
    throw error;
  }
};

// Fonction pour créer plusieurs paiements de test avec différents statuts
export const createMultipleTestPayments = async () => {
  const statuses = ['pending', 'completed', 'failed', 'refunded'];
  const methods = ['mobile_money', 'card', 'bank_transfer'];
  
  try {
    for (let i = 0; i < 10; i++) {
      const testPayment = {
        orderId: `test-order-${Date.now()}-${i}`,
        transactionId: `test-transaction-${Date.now()}-${i}`,
        amount: Math.floor(Math.random() * 50000) + 1000,
        currency: 'XOF',
        method: methods[Math.floor(Math.random() * methods.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        customerEmail: `test${i}@example.com`,
        description: `Paiement de test ${i + 1}`,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Derniers 7 jours
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'payments'), testPayment);

    }

  } catch (error) {
    console.error('Erreur lors de la création des paiements de test:', error);
    throw error;
  }
};