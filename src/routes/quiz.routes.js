const express = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const { getIsConnected, memoryStore } = require('../config/db');
const { generateQuiz } = require('../services/flaskClient');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');

const router = express.Router();
router.use(verifyToken);

// Generate practice quiz on a topic
router.post('/generate', async (req, res) => {
  try {
    const { topic = 'General Science', count = 4, sessionId } = req.body;
    const quizData = await generateQuiz({ topic, count });

    let savedQuiz;
    if (getIsConnected()) {
      savedQuiz = await Quiz.create({
        sessionId,
        topic: quizData.topic,
        questions: quizData.questions
      });
    } else {
      savedQuiz = {
        _id: 'q_' + Date.now(),
        sessionId,
        topic: quizData.topic,
        questions: quizData.questions,
        createdAt: new Date()
      };
      memoryStore.quizzes.push(savedQuiz);
    }

    res.json({ success: true, quiz: savedQuiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record quiz attempt
router.post('/attempt', async (req, res) => {
  try {
    const { quizId, topic, score, totalQuestions, answers, weakAreas = [] } = req.body;
    const studentId = req.user.id;
    const studentName = req.user.name || 'Student';

    let attempt;
    if (getIsConnected()) {
      attempt = await QuizAttempt.create({
        quizId,
        studentId,
        studentName,
        topic,
        score,
        totalQuestions,
        answers,
        weakAreas
      });
    } else {
      attempt = {
        _id: 'att_' + Date.now(),
        quizId,
        studentId,
        studentName,
        topic,
        score,
        totalQuestions,
        answers,
        weakAreas,
        createdAt: new Date()
      };
      memoryStore.attempts.push(attempt);
    }

    res.status(201).json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user quiz history
router.get('/history', async (req, res) => {
  try {
    const studentId = req.user.id;
    let attempts = [];
    if (getIsConnected()) {
      attempts = await QuizAttempt.find({ studentId }).sort({ createdAt: -1 });
    } else {
      attempts = memoryStore.attempts.filter(a => a.studentId === studentId).sort((a,b) => b.createdAt - a.createdAt);
    }
    res.json({ success: true, attempts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
