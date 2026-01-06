// backend/models/Conversation.js
const { Schema, model } = require('mongoose');

const conversationSchema = new Schema({
  participants: [
    { type: Schema.Types.ObjectId, ref: 'User', required: true }
  ],
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  updatedAt: { type: Date, default: Date.now }
});

conversationSchema.index({ participants: 1 });

module.exports = model('Conversation', conversationSchema);
