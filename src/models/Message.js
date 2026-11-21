const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  sender: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  visualData: {
    type: { type: String },
    title: { type: String },
    caption: { type: String },
    svg: { type: String }
  },
  audioData: { type: String },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
