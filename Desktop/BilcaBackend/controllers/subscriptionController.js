const mercadopago = require('mercadopago');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const PLANS = {
  professional: {
    name: 'Plan Profesional',
    price: 299,
    currency: 'ARS',
    description: '✅ Verificado + Destacado en búsquedas',
  },
  featured: {
    name: 'Plan Destacado',
    price: 499,
    currency: 'ARS',
    description: '✅ Verificado + Recomendado + Contratos gratis',
  }
};

// ✅ Validación de plan
const validateSubscriptionPlan = (plan) => {
  if (!plan) {
    throw new Error("El plan es requerido");
  }
  
  if (!PLANS[plan]) {
    throw new Error("Plan no válido. Opciones: professional, featured");
  }
  
  return plan;
};

exports.createSubscription = async (req, res) => {
  const { plan } = req.body;
  const userId = req.user.id;

  try {
    // ✅ Validación de datos
    const validatedPlan = validateSubscriptionPlan(plan);

    const user = await User.findById(userId);
    if (!user || user.role !== 'worker') {
      return res.status(404).json({ msg: 'Trabajador no encontrado' });
    }

    // ✅ Verificar que no tenga una suscripción activa
    const existingSubscription = await Subscription.findOne({ 
      userId, 
      status: 'active' 
    });
    
    if (existingSubscription) {
      // ✅ Si ya tiene suscripción activa, devolver el init_point existente
      return res.status(409).json({ 
        msg: 'Ya tienes una suscripción activa', 
        init_point: existingSubscription.mercadopagoInitPoint || null,
        subscriptionId: existingSubscription._id
      });
    }

    const preference = {
      items: [{
        title: PLANS[validatedPlan].name,
        description: PLANS[validatedPlan].description,
        quantity: 1,
        currency_id: 'ARS',
        unit_price: PLANS[validatedPlan].price
      }],
      back_urls: {
        success: `${process.env.CLIENT_URL}/dashboard/subscription/success`,
        failure: `${process.env.CLIENT_URL}/dashboard/subscription/failure`,
        pending: `${process.env.CLIENT_URL}/dashboard/subscription/pending`
      },
      auto_return: 'approved',
      payer: {
        email: user.email
      },
      metadata: {
        userId: userId.toString(),
        plan: validatedPlan
      }
    };

    const mpResponse = await mercadopago.preferences.create(preference);
    const preferenceId = mpResponse.body.id;
    const initPoint = mpResponse.body.init_point;

    const subscription = new Subscription({
      userId,
      plan: validatedPlan,
      mercadopagoPreferenceId: preferenceId,
      mercadopagoInitPoint: initPoint
    });
    await subscription.save();

    res.json({
      init_point: initPoint,
      subscriptionId: subscription._id
    });

  } catch (err) {
    console.error('Error al crear suscripción:', err.message);
    
    if (err.message.includes('plan es requerido') || err.message.includes('Plan no válido')) {
      return res.status(400).json({ msg: err.message });
    }
    
    // ✅ Manejo específico de errores de Mercado Pago
    if (err.response?.data?.message) {
      return res.status(500).json({ 
        msg: "Error al procesar la suscripción con Mercado Pago",
        detail: err.response.data.message 
      });
    }
    
    res.status(500).json({ msg: 'Error al procesar la suscripción' }); 
  }
};
