// models/Review.js
const { Schema, model } = require('mongoose');

const reviewSchema = new Schema({
  hire: { type: Schema.Types.ObjectId, ref: 'Hire', required: true },
  worker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, 
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
  reply: {
    text: String,
    createdAt: { type: Date, default: Date.now },
    fromWorker: { type: Schema.Types.ObjectId, ref: 'User' }
  }
}, {
  timestamps: true
});

module.exports = model('Review', reviewSchema);