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
    const { topic = 'General Academic Science', count = 4, sessionId } = req.body;
    let quizData;
    try {
      quizData = await generateQuiz({ topic, count });
    } catch (flaskErr) {
      console.warn('Flask quiz generation warming up, using fallback quiz:', flaskErr.message);
      quizData = {
        topic: topic.slice(0, 40),
        questions: [
          {
            id: 1,
            question: `What is the primary academic significance of ${topic}?`,
            options: [
              'It provides foundational principles for analytical problem solving',
              'It eliminates the need for scientific observation',
              'It operates completely independently of physical laws',
              'It is only applicable in theoretical simulations'
            ],
            correctAnswer: 0,
            explanation: `${topic} establishes essential theoretical foundations and principles verified through experiments and practice.`
          },
          {
            id: 2,
            question: `Which component represents the core operational mechanism of ${topic}?`,
            options: [
              'Random fluctuation without measurable rules',
              'Systematic processing connecting inputs to validated outputs',
              'Static storage with no transformations',
              'External manual intervention at every cycle'
            ],
            correctAnswer: 1,
            explanation: `Concepts like ${topic} rely on structured operational mechanisms where inputs undergo transformation into observable outputs.`
          },
          {
            id: 3,
            question: `How are claims in ${topic} verified in standard scientific and academic practice?`,
            options: [
              'Through arbitrary consensus without tests',
              'Through empirical evidence and replicable proofs',
              'By disregarding outlier data points',
              'By relying exclusively on preliminary hypotheses'
            ],
            correctAnswer: 1,
            explanation: `Academic verification requires empirical repeatability and methodical validation.`
          },
          {
            id: 4,
            question: `In modern applications, what is a primary real-world benefit of mastering ${topic}?`,
            options: [
              'Designing efficient systems and solving practical real-world problems',
              'Avoiding all computational or physical calculations',
              'Replacing all hardware with static text',
              'Restricting scientific knowledge to a single discipline'
            ],
            correctAnswer: 0,
            explanation: `Mastering foundational concepts equips students to engineer real-world systems and solve complex problems.`
          }
        ]
      };
    }

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
    console.error('Quiz error:', err);
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
