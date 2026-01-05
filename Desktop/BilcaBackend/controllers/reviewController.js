const Hire = require("../models/Hire");
const Review = require("../models/Review"); 
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;

// ✅ Validación de calificación
const validateRating = (rating) => {
  if (rating === undefined || rating === null) {
    throw new Error("La calificación es requerida");
  }
  
  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
    throw new Error("La calificación debe ser un número entero entre 1 y 5");
  }
  
  return numRating;
};

// ✅ Validación de comentario
const validateComment = (comment) => {
  if (comment === undefined || comment === null) {
    return "";
  }
  
  if (typeof comment !== 'string') {
    throw new Error("El comentario debe ser texto");
  }
  
  const trimmed = comment.trim();
  if (trimmed.length > 500) {
    throw new Error("El comentario no puede exceder los 500 caracteres");
  }
  
  return trimmed;
};

exports.validateReviewToken = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ valid: false, msg: "Token requerido" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // ✅ Validar que decoded tenga los campos necesarios
    if (!decoded.hireId || !decoded.clientId) {
      return res.status(400).json({ valid: false, msg: "Token inválido" });
    }

    const hire = await Hire.findById(decoded.hireId).populate('client worker');

    if (!hire || hire.client._id.toString() !== decoded.clientId) {
      return res.status(400).json({ valid: false, msg: "Token inválido" });
    }

    if (hire.review?.reviewedAt) {
      return res.status(400).json({ valid: false, msg: "Ya has dejado tu reseña" });
    }

    if (!hire.completedAt) {
      return res.status(400).json({ valid: false, msg: "Trabajo no completado" });
    }

    const tenDaysAfter = new Date(hire.completedAt);
    tenDaysAfter.setDate(tenDaysAfter.getDate() + 10);

    if (new Date() > tenDaysAfter) {
      return res.status(400).json({ valid: false, msg: "El período de reseña ha expirado" });
    }

    res.json({
      valid: true,
      hire: {
        _id: hire._id,
        worker: {
          _id: hire.worker._id,
          name: hire.worker.name,
          photo: hire.worker.photo
        },
        service: hire.service || "Servicio",
        description: hire.description
      }
    });
  } catch (err) {
    console.error("Error en validateReviewToken:", err.message);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ valid: false, msg: "Token inválido o expirado" });
    }
    
    res.status(500).json({ valid: false, msg: "Error del servidor" });
  }
};

exports.submitReview = async (req, res) => {
  const { token, rating, comment } = req.body;

  try {
    // ✅ Validación de datos
    if (!token) {
      return res.status(400).json({ msg: "Token requerido" });
    }

    const numRating = validateRating(rating);
    const validatedComment = validateComment(comment);

    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (!decoded.hireId || !decoded.clientId) {
      return res.status(400).json({ msg: "Token inválido" });
    }

    const hire = await Hire.findById(decoded.hireId).populate('client worker');

    if (!hire || hire.client._id.toString() !== decoded.clientId) {
      return res.status(400).json({ msg: "Token inválido" });
    }

    if (hire.review?.reviewedAt) {
      return res.status(400).json({ msg: "Ya has enviado tu reseña" });
    }

    if (!hire.completedAt) {
      return res.status(400).json({ msg: "Trabajo no completado" });
    }

    // ✅ Verificar período de reseña
    const tenDaysAfter = new Date(hire.completedAt);
    tenDaysAfter.setDate(tenDaysAfter.getDate() + 10);
    if (new Date() > tenDaysAfter) {
      return res.status(400).json({ msg: "El período de reseña ha expirado" });
    }

    hire.review = {
      rating: numRating,
      comment: validatedComment,
      reviewedAt: new Date()
    };
    await hire.save();

    const review = new Review({
      hire: hire._id,
      worker: hire.worker._id,
      user: hire.client._id,
      rating: numRating,
      comment: validatedComment
    });
    await review.save();

    await updateWorkerRating(hire.worker._id);

    res.json({ msg: "¡Gracias por tu reseña!" });
  } catch (err) {
    console.error("Error en submitReview:", err.message);
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(400).json({ msg: "Token inválido o expirado" });
    }
    
    if (err.message.includes('calificación') || err.message.includes('comentario')) {
      return res.status(400).json({ msg: err.message });
    }
    
    res.status(500).json({ msg: "Error al enviar la reseña" });
  }
};

exports.getWorkerReviews = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Validar ID de trabajador
    if (!id) {
      return res.status(400).json({ msg: "ID de trabajador requerido" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // ✅ Límite máximo de 50
    const skip = (page - 1) * limit;

    const total = await Review.countDocuments({ worker: id });
    const reviews = await Review.find({ worker: id })
      .populate("user", "name photo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      reviews: reviews || [],
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasPrev: page > 1,
        hasNext: page < Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error en getWorkerReviews:", err.message);
    res.status(500).json({ msg: "Error del servidor" });
  }
};

async function updateWorkerRating(workerId) {
  try {
    const reviews = await Review.find({ worker: workerId });
    if (reviews.length === 0) {
      await User.findByIdAndUpdate(workerId, { rating: 0, totalJobs: 0 });
      return;
    }

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await User.findByIdAndUpdate(workerId, {
      rating: parseFloat(avgRating.toFixed(1)),
      totalJobs: reviews.length
    });
  } catch (err) {
    console.error("Error en updateWorkerRating:", err.message);
  }
}
