const express = require('express');
const router = express.Router();
const axios = require('axios');
const NodeCache = require('node-cache');

// Configuration des variables d'environnement
const {
  AUTH_BASE_URL,
  REALM,
  CLIENT_ID,
  CLIENT_SECRET,
  BASE_API_URL,
} = process.env;

// Validation des variables d'environnement
const requiredEnvVars = ['AUTH_BASE_URL', 'REALM', 'CLIENT_ID', 'CLIENT_SECRET', 'BASE_API_URL'];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Erreur : la variable d'environnement ${varName} est manquante.`);
    process.exit(1);
  }
});

// Cache pour le jeton d'accès
const tokenCache = new NodeCache({ stdTTL: 1700 }); // Cache pour 28 minutes (1800s - marge de 100s)

// Fonction pour obtenir un jeton d'accès
const getAccessToken = async () => {
  const cachedToken = tokenCache.get('access_token');
  if (cachedToken) return cachedToken;

  try {
    const authString = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(
      `${AUTH_BASE_URL}/realms/${REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          Authorization: `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;
    tokenCache.set('access_token', access_token, expires_in - 100); // Cache avec marge
    return access_token;
  } catch (error) {
    console.error('Erreur lors de l\'obtention du jeton d\'accès:', error.response?.data || error.message);
    throw new Error('Impossible d\'obtenir le jeton d\'accès pour l\'API Flashup.');
  }
};

// Middleware pour valider la requête d'initialisation du paiement
const validatePaymentRequest = (req, res, next) => {
  const { amount, description, success_url, failure_url } = req.body;
  if (!amount || !description || !success_url || !failure_url) {
    return res.status(400).json({
      success: false,
      message: 'Champs requis manquants (amount, description, success_url, failure_url).',
      code: 'FLASHP_INP_99',
    });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Le montant doit être un nombre positif.',
      code: 'FLASHP_INP_99',
    });
  }
  next();
};

// Initialisation du paiement
router.post('/init', validatePaymentRequest, async (req, res) => {
  try {
    const { amount, description, success_url, failure_url, customer_email, customer_phone, order_id, callback_url } = req.body;

    // Obtenir le jeton d'accès
    const accessToken = await getAccessToken();

    // Appeler l'API Flashup pour initialiser le paiement
    const paymentResponse = await axios.post(
      `${BASE_API_URL}/rest/api/v1/payments/init`,
      {
        amount: parseFloat(amount),
        description,
        success_url,
        failure_url,
        ...(customer_email && { customer_email }), // Champs optionnels
        ...(customer_phone && { customer_phone }),
        ...(order_id && { order_id }),
        ...(callback_url && { callback_url }),
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const { status, payment_url, transaction_code } = paymentResponse.data;

    if (!payment_url || status !== 'SAVED') {
      throw new Error('URL de paiement non fournie ou statut invalide.');
    }

    res.status(200).json({
      success: true,
      paymentUrl: payment_url,
      transactionId: transaction_code, // Retourner transaction_code pour le frontend
    });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du paiement:', error.response?.data || error.message);
    const errorDetails = error.response?.data || {};
    res.status(errorDetails.status || 500).json({
      success: false,
      message: errorDetails.title || 'Erreur lors de l\'initialisation du paiement.',
      code: errorDetails.code || 'FLASHP_ERR_99',
      error_details: errorDetails.error_details || [],
    });
  }
});

// Vérification du statut du paiement
router.get('/status', async (req, res) => {
  const { transaction_id } = req.query;

  if (!transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'L\'identifiant de la transaction est requis.',
      code: 'FLASHP_INP_99',
    });
  }

  try {
    // Obtenir le jeton d'accès
    const accessToken = await getAccessToken();

    // Vérifier le statut via l'API Flashup
    const statusResponse = await axios.get(
      `${BASE_API_URL}/rest/api/v1/payments/${transaction_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const { status } = statusResponse.data;

    res.status(200).json({
      success: true,
      status: status.toLowerCase(), // Normaliser (ex: 'SUCCEEDED' -> 'success')
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut:', error.response?.data || error.message);
    const errorDetails = error.response?.data || {};
    res.status(errorDetails.status || 500).json({
      success: false,
      message: errorDetails.title || 'Erreur lors de la vérification du statut du paiement.',
      code: errorDetails.code || 'FLASHP_ERR_99',
      error_details: errorDetails.error_details || [],
    });
  }
});

module.exports = router;