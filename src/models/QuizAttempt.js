const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
  quizId: { type: String },
  studentId: { type: String, required: true },
  studentName: { type: String, default: 'Student' },
  topic: { type: String, required: true },
  score: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  answers: [{
    questionIndex: Number,
    selectedOption: Number,
    isCorrect: Boolean
  }],
  weakAreas: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', QuizAttemptSchema);
