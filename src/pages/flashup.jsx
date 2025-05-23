let api_token = "";
let wrong_token = false;

async function appInit() {
  api_token = "not_needed"; // Simuler pour compatibilité
  wrong_token = false;
  return api_token;
}

async function initTrx(amount, description, successUrl, failureUrl) {
  try {
    const response = await fetch(
      "https://us-central1-papersbook-f3826.cloudfunctions.net/flashpay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "initTrx",
          amount,
          description,
          successUrl,
          failureUrl,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur HTTP ${response.status}`);
    }

    return {
      payment_url: data.payment_url,
      code: data.code,
    };
  } catch (error) {
    console.error("Erreur dans initTrx :", error);
    throw error;
  }
}

async function getTrxStatus(transactionCode) {
  try {
    const response = await fetch(
      "https://us-central1-papersbook-f3826.cloudfunctions.net/flashpay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "getTrxStatus",
          transactionCode,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur HTTP ${response.status}`);
    }

    return {
      status: data.status,
      transaction_code: data.transaction_code,
    };
  } catch (error) {
    console.error("Erreur dans getTrxStatus :", error);
    throw error;
  }
}

export { appInit, initTrx, getTrxStatus };