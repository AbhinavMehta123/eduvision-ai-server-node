const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true },
  explanation: { type: String }
});

const QuizSchema = new mongoose.Schema({
  sessionId: { type: String },
  topic: { type: String, required: true },
  questions: [QuestionSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
