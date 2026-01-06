// backend/controllers/webhookController.js
const mercadopago = require("mercadopago");
const crypto = require("crypto");
const Subscription = require("../models/Subscription");
const User = require("../models/User");

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// =========================
// Validación de firma
// =========================
const validateSignature = (req) => {
  const signature = req.headers["x-signature"];
  if (!signature) return false;

  const [tsPart, hashPart] = signature.split(",");
  const ts = tsPart?.split("ts=")[1];
  const hash = hashPart?.split("h=")[1];
  if (!ts || !hash) return false;

  const manifest = `id:${req.body.id},ts:${ts}`;
  const expectedHash = crypto
    .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  return hash === expectedHash;
};

// =========================
// Webhook handler
// =========================
exports.handleMercadoPagoWebhook = async (req, res) => {
  if (!validateSignature(req)) {
    return res.status(401).send("Firma inválida");
  }

  const { type, data } = req.body;
  if (type !== "payment") {
    return res.status(200).send("Ignorado");
  }

  try {
    const payment = await mercadopago.payment.get(data.id);
    const { metadata, status, preference_id } = payment.body;

    const userId = metadata?.userId;
    const plan = metadata?.plan;

    if (!userId || !plan) {
      console.warn("⚠️ Pago sin metadata válida:", data.id);
      return res.status(200).send("OK");
    }

    // =========================
    // Idempotencia fuerte
    // =========================
    const alreadyProcessed = await Subscription.findOne({
      mercadopagoSubscriptionId: data.id,
    });
    if (alreadyProcessed) {
      return res.status(200).send("OK");
    }

    let subscription = await Subscription.findOne({
      mercadopagoPreferenceId: preference_id,
    });

    if (!subscription) {
      subscription = new Subscription({
        userId,
        plan,
        mercadopagoPreferenceId: preference_id,
      });
    }

    subscription.mercadopagoSubscriptionId = data.id;

    // =========================
    // Estados
    // =========================
    if (status === "approved") {
      subscription.status = "active";
      subscription.nextBillingDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      );

      await User.findByIdAndUpdate(userId, {
        subscriptionTier: plan, // professional | featured
        isVerified: true,
      });
    } else if (["rejected", "cancelled", "refunded"].includes(status)) {
      subscription.status = "failed";

      await User.findByIdAndUpdate(userId, {
        subscriptionTier: "none",
        isVerified: false,
      });
    }

    await subscription.save();

    console.log(
      `✅ Webhook MP procesado | user=${userId} | plan=${plan} | status=${status}`
    );
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error en webhook MercadoPago:", err.message);
    res.status(500).send("Error");
  }
};
