const mongoose = require('mongoose');

const ChatSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, default: 'New Academic Discussion' },
  subject: { type: String, default: 'General Science' },
  language: { type: String, default: 'en' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.ChatSession || mongoose.model('ChatSession', ChatSessionSchema);
