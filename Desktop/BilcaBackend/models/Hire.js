const { Schema, model } = require('mongoose');

const hireSchema = new Schema({
  worker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: ['pendiente', 'aceptado', 'rechazado', 'completado'],
    default: 'pendiente'
  },
  date: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  
  // ✅ Nuevos campos para el sistema de reseñas automático
  clientCompleted: { type: Boolean, default: false },
  workerCompleted: { type: Boolean, default: false },
  reviewEmailSent: { type: Boolean, default: false },
  reviewTokenUsed: { type: Boolean, default: false },
  reviewSentAt: { type: Date },
  
  review: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 500 },
    reviewedAt: { type: Date }
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas
hireSchema.index({ client: 1, worker: 1 });
hireSchema.index({ worker: 1, status: 1 });
hireSchema.index({ completedAt: 1, reviewEmailSent: 1 });

module.exports = model('Hire', hireSchema);
