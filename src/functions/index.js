const functions = require("firebase-functions");
const fetch = require("node-fetch");

exports.flashpay = functions.https.onRequest(async (req, res) => {
  try {
    const { action, amount, description, successUrl, failureUrl, transactionCode } = req.body;
    if (!action) {
      return res.status(400).json({ error: "Action requise" });
    }

    // Authentification
    const authParams = new URLSearchParams({ grant_type: "client_credentials" });
    const authResponse = await fetch(
      "https://auth.seed-apps.com/realms/flashpay/protocol/openid-connect/token",
      {
        method: "POST",
        body: authParams.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("api-000003-cc:AC1HRSNpPp0Wd6SVk4rClJna8nrmtpr2").toString("base64")}`,
        },
      }
    );

    if (!authResponse.ok) {
      throw new Error(`Erreur HTTP ${authResponse.status}`);
    }

    const authData = await authResponse.json();
    const token = authData.access_token;

    // Actions
    if (action === "initTrx") {
      if (!amount || !description || !successUrl || !failureUrl) {
        return res.status(400).json({ error: "Paramètres manquants pour initTrx" });
      }
      const response = await fetch(
        "https://flashup.seed-apps.com/rest/api/v1/payments/init",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: Number(amount),
            description,
            success_url: successUrl,
            failure_url: failureUrl,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: errorData.error_details?.[0]?.message || "Erreur lors de l'initialisation" });
      }

      const data = await response.json();
      return res.status(200).json({
        payment_url: data.payment_url,
        code: data.transaction_code,
      });
    } else if (action === "getTrxStatus") {
      if (!transactionCode) {
        return res.status(400).json({ error: "transactionCode requis" });
      }
      const response = await fetch(
        `https://flashup.seed-apps.com/rest/api/v1/payments/${transactionCode}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: errorData.error_details?.[0]?.message || "Erreur lors de la vérification" });
      }

      const data = await response.json();
      return res.status(200).json({
        status: data.status,
        transaction_code: data.transaction_code,
      });
    } else {
      return res.status(400).json({ error: "Action non reconnue" });
    }
  } catch (err) {
    console.error("Erreur dans flashpay:", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});