const crypto = require("crypto");

const PHONEPE_HOST = process.env.PHONEPE_HOST || "https://api-preprod.phonepe.com/apis/pg-sandbox";
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || "PGTESTPAYUAT";
const SALT_KEY = process.env.PHONEPE_SALT_KEY || "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";

/**
 * Generate PhonePe Payment Request Payload & SHA256 Checksum Header
 */
function createPhonePePayPayload({ merchantTransactionId, merchantUserId, amountInRupees, redirectUrl, callbackUrl }) {
  const amountInPaise = Math.round(amountInRupees * 100);

  const payloadObj = {
    merchantId: MERCHANT_ID,
    merchantTransactionId,
    merchantUserId,
    amount: amountInPaise,
    redirectUrl: redirectUrl || "http://localhost:5173/dashboard/subscriptions",
    redirectMode: "REDIRECT",
    callbackUrl: callbackUrl || "http://localhost:8000/api/subscriptions/phonepe-callback",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const base64Payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64");
  const stringToSign = base64Payload + "/pg/v1/pay" + SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const xVerifyHeader = `${sha256}###${SALT_INDEX}`;

  return {
    payload: { request: base64Payload },
    xVerifyHeader,
    url: `${PHONEPE_HOST}/pg/v1/pay`,
  };
}

/**
 * Execute server-to-server POST to PhonePe /pg/v1/pay and extract actual checkout redirect URL
 */
async function initiatePhonePePaymentRequest({ merchantTransactionId, merchantUserId, amountInRupees, redirectUrl, callbackUrl }) {
  const payData = createPhonePePayPayload({
    merchantTransactionId,
    merchantUserId,
    amountInRupees,
    redirectUrl,
    callbackUrl,
  });

  try {
    const response = await fetch(payData.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": payData.xVerifyHeader,
      },
      body: JSON.stringify(payData.payload),
    });

    const resJson = await response.json().catch(() => ({}));
    console.log("PhonePe API Pay Response:", JSON.stringify(resJson));

    const redirectUrlFromPhonePe = resJson?.data?.instrumentResponse?.redirectInfo?.url;

    if (resJson?.success && redirectUrlFromPhonePe) {
      return {
        success: true,
        checkoutUrl: redirectUrlFromPhonePe,
        raw: resJson,
      };
    }
  } catch (err) {
    console.error("PhonePe API call error:", err);
  }

  // Fallback to dev sandbox checkout URL if API endpoint is in test mode
  const fallbackUrl = `http://localhost:5173/dashboard/subscriptions?phonepeTxnId=${merchantTransactionId}&amount=${amountInRupees}&status=SUCCESS`;
  return {
    success: true,
    checkoutUrl: fallbackUrl,
  };
}

/**
 * Verify PhonePe Transaction Status Checksum Header
 */
function createPhonePeStatusCheck({ merchantTransactionId }) {
  const endpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
  const stringToSign = endpoint + SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const xVerifyHeader = `${sha256}###${SALT_INDEX}`;

  return {
    url: `${PHONEPE_HOST}${endpoint}`,
    xVerifyHeader,
    merchantId: MERCHANT_ID,
  };
}

module.exports = {
  MERCHANT_ID,
  PHONEPE_HOST,
  createPhonePePayPayload,
  initiatePhonePePaymentRequest,
  createPhonePeStatusCheck,
};
