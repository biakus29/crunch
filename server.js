const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.status(200).send("Serveur de notifications Mange d'abord en cours d'exécution");
});

app.post("/send-notification", async (req, res) => {
  const { token, title, body, data } = req.body;

  console.log("Requête reçue:", { token, title, body, data });

  if (!token || !title || !body) {
    return res.status(400).send("Token, titre et corps de la notification requis");
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: data || {},
    token,
  };

  try {
    await admin.messaging().send(message);
    console.log("Notification envoyée à:", token);
    res.status(200).send("Notification envoyée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'envoi de la notification:", error);
    if (error.code === "messaging/registration-token-not-registered") {
      const userRef = admin.firestore().collection("usersrestau").where("fcmToken", "==", token);
      const snapshot = await userRef.get();
      snapshot.forEach((doc) => doc.ref.update({ fcmToken: admin.firestore.FieldValue.delete() }));
      res.status(400).send("Token FCM invalide ou non enregistré");
    } else {
      res.status(500).send("Erreur lors de l'envoi de la notification");
    }
  }
});

app.get("/health", (req, res) => {
  res.status(200).send("Serveur opérationnel");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});