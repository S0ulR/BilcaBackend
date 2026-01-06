// backend/models/Message.js
const { Schema, model } = require('mongoose');

const messageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  read: { type: Boolean, default: false },
  conversation: { 
    type: Schema.Types.ObjectId, 
    ref: 'Conversation',
    required: true
  },
  // Guardar URL y metadatos
  fileUrl: String,
  fileName: String,
  fileType: { 
    type: String, 
    enum: ['image', 'pdf'] 
  }
}, {
  timestamps: true
});

module.exports = model('Message', messageSchema);
