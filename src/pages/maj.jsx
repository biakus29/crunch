import { getFirestore, doc, getDoc, writeBatch } from 'firebase/firestore';
import { useEffect } from 'react';

function ChangerId() {
    const db = getFirestore();

    useEffect(() => {
        async function changerIdDocument() {
            const batch = writeBatch(db);
            try {
                const ancienDocRef = doc(db, 'menus', 'J9JF1sFZXFhbsnMLOu7f');
                const ancienDocSnap = await getDoc(ancienDocRef);

                if (ancienDocSnap.exists()) {
                    const nouvelId = 'w7GfdWHo77RDO2MlDtSz';
                    const nouveauDocRef = doc(db, 'menus', nouvelId);
                    batch.set(nouveauDocRef, ancienDocSnap.data());
                    batch.delete(ancienDocRef);
                    await batch.commit();
                    console.log(`Document migré avec succès de ${ancienDocRef.id} à ${nouvelId}`);
                } else {
                    console.log('Document introuvable.');
                }
            } catch (e) {
                console.error('Erreur : ', e);
            }
        }
        changerIdDocument();
    }, []);

    return <div>Changement d'ID en cours...</div>;
}

export default ChangerId;