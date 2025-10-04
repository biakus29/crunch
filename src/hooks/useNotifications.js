// src/hooks/useNotifications.js
import { useEffect } from "react";
import { messaging, isSupported } from "../firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

const VAPID_KEY = "BHnVLhfreD5NmV_RYjOvSkJoh2NtJNV1hFOxi__f-SFz9Cf_iatVJC807jWukr6TicgDNHVx-rErZkWBA84rq88";

const useNotifications = (onNotificationReceived) => {
  const requestNotificationPermission = async () => {
    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn("Ce navigateur ne supporte pas Firebase Cloud Messaging.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission === "granted") {

        const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration,
        });

        if (token && auth.currentUser) {
          const userRef = doc(db, "usersrestau", auth.currentUser.uid);
          await updateDoc(userRef, { fcmToken: token });

        }
      } else {

      }
    } catch (error) {
      console.error("Erreur lors de la demande de permission ou génération du token:", error);
    }
  };

  useEffect(() => {
    if ("Notification" in window && auth.currentUser) {
      requestNotificationPermission();
    }
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    isSupported().then((supported) => {
      if (!supported) {
        console.warn("Messagerie non supportée pour onMessage.");
        return;
      }
      const unsubscribe = onMessage(messaging, (payload) => {

        if (onNotificationReceived) {
          onNotificationReceived({
            id: payload.messageId || Date.now().toString(),
            orderId: payload.data?.orderId || "",
            newStatus: payload.data?.status || "",
            message: payload.notification?.body || "Nouvelle notification",
            timestamp: new Date(),
            read: false,
            userId: auth.currentUser?.uid || "",
          });
        }
      });

      return () => unsubscribe();
    });
  }, [onNotificationReceived]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const interval = setInterval(async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;

        const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const newToken = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration,
        });
        if (newToken && auth.currentUser) {
          const userRef = doc(db, "usersrestau", auth.currentUser.uid);
          const userSnapshot = await getDoc(userRef);
          const currentToken = userSnapshot.data()?.fcmToken;
          if (newToken !== currentToken) {
            await updateDoc(userRef, { fcmToken: newToken });

          }
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du token:", error);
      }
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [auth.currentUser?.uid]);
};

export default useNotifications;
