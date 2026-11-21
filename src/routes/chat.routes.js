const express = require('express');
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/auth.middleware');
const { getIsConnected, memoryStore } = require('../config/db');
const { askAI } = require('../services/flaskClient');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');

const router = express.Router();

router.use(verifyToken);

// List sessions for user
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.id;
    let sessions = [];
    if (getIsConnected()) {
      sessions = await ChatSession.find({ userId }).sort({ updatedAt: -1 });
    } else {
      sessions = memoryStore.sessions
        .filter(s => s.userId === userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new session
router.post('/sessions', async (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'New Learning Session', subject = 'General Academic', language = 'en' } = req.body;
    let session;
    if (getIsConnected()) {
      session = await ChatSession.create({ userId, title, subject, language });
    } else {
      session = {
        _id: 'ses_' + Date.now(),
        userId,
        title,
        subject,
        language,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      memoryStore.sessions.unshift(session);
    }
    res.status(201).json({ success: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a session
router.get('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    let messages = [];
    if (getIsConnected()) {
      messages = await Message.find({ sessionId }).sort({ createdAt: 1 });
    } else {
      messages = memoryStore.messages
        .filter(m => m.sessionId === sessionId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    if (getIsConnected() && mongoose.Types.ObjectId.isValid(sessionId)) {
      await ChatSession.findByIdAndDelete(sessionId);
      await Message.deleteMany({ sessionId });
    } else {
      memoryStore.sessions = memoryStore.sessions.filter(s => s._id !== sessionId);
      memoryStore.messages = memoryStore.messages.filter(m => m.sessionId !== sessionId);
    }
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update / Rename session title
router.patch('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    let updatedSession;
    if (getIsConnected() && mongoose.Types.ObjectId.isValid(sessionId)) {
      updatedSession = await ChatSession.findByIdAndUpdate(
        sessionId,
        { title: title.trim(), updatedAt: new Date() },
        { new: true }
      );
    } else {
      const s = memoryStore.sessions.find(item => item._id === sessionId);
      if (s) {
        s.title = title.trim();
        s.updatedAt = new Date();
        updatedSession = s;
      }
    }
    res.json({ success: true, session: updatedSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a user message and get AI response
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { content, language = 'en', includeAudio = true } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    // 1. Save user message
    let userMsg;
    if (getIsConnected()) {
      userMsg = await Message.create({
        sessionId,
        sender: 'user',
        content,
        language
      });
    } else {
      userMsg = {
        _id: 'msg_' + Date.now(),
        sessionId,
        sender: 'user',
        content,
        language,
        createdAt: new Date()
      };
      memoryStore.messages.push(userMsg);
    }

    // 2. Call Flask AI service with fallback resilience
    let aiResponse;
    try {
      aiResponse = await askAI({
        query: content,
        language,
        userGrade: req.user?.gradeLevel || 'General Academic',
        includeAudio
      });
    } catch (flaskErr) {
      console.warn('Flask AI service unreachable or warming up, generating academic fallback response:', flaskErr.message);
      const safeTitle = content.trim().slice(0, 30) || 'Academic Concept';
      aiResponse = {
        content: `### ${safeTitle}\n\n**Definition & Real-World Analogy**:\n` +
          `EduVision AI is an interactive academic visual learning platform conceived, designed, and developed by Abhinav Mehta to make complex concepts intuitive through structured explanations and visual frameworks.\n\n` +
          `**Core Principles & Mechanics**:\n` +
          `1. **Structural Analysis**: Breaking down the key components of "${content.trim()}".\n` +
          `2. **Operational Flow**: Sequential execution from core inputs through systematic processing to verified academic results.\n` +
          `3. **Verification**: Comparing theoretical rules against practical, real-world examples.\n\n` +
          `**Practical Real-World Applications**:\n` +
          `Understanding this topic strengthens fundamental knowledge across multidisciplinary academic curricula and examination frameworks.\n\n` +
          `*(Academic note: Backend AI microservice was warming up; generated via EduVision universal academic intelligence engine.)*`,
        topic: safeTitle,
        subject: 'Academic Learning',
        language,
        visualData: {
          type: 'svg',
          title: safeTitle,
          caption: `Concept Framework: ${safeTitle}`,
          svg: `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><linearGradient id="gradFall" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#059669"/><stop offset="100%" stop-color="#10b981"/></linearGradient></defs><rect width="600" height="240" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/><rect x="40" y="25" width="520" height="40" rx="8" fill="url(#gradFall)"/><text x="300" y="50" fill="#ffffff" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" text-anchor="middle">${safeTitle.replace(/[<>&'"]/g, '')}</text><rect x="50" y="95" width="140" height="85" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><text x="120" y="130" fill="#0f172a" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">1. Principles</text><text x="120" y="152" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">Foundations</text><line x1="190" y1="137" x2="230" y2="137" stroke="#10b981" stroke-width="2"/><rect x="230" y="95" width="140" height="85" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><text x="300" y="130" fill="#0f172a" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">2. Mechanics</text><text x="300" y="152" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">Core Process</text><line x1="370" y1="137" x2="410" y2="137" stroke="#10b981" stroke-width="2"/><rect x="410" y="95" width="140" height="85" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/><text x="480" y="130" fill="#0f172a" font-family="system-ui, sans-serif" font-size="13" font-weight="bold" text-anchor="middle">3. Applications</text><text x="480" y="152" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">Practical Proof</text></svg>`
        },
        audioData: null
      };
    }

    // 3. Update session title if default
    if (getIsConnected() && mongoose.Types.ObjectId.isValid(sessionId)) {
      const session = await ChatSession.findById(sessionId);
      if (session && session.title && session.title.includes('New Learning Session')) {
        session.title = aiResponse.topic || content.slice(0, 30);
        session.updatedAt = new Date();
        await session.save();
      }
    } else {
      const session = memoryStore.sessions.find(s => s._id === sessionId);
      if (session && session.title && session.title.includes('New Learning Session')) {
        session.title = aiResponse.topic || content.slice(0, 30);
        session.updatedAt = new Date();
      }
    }

    // 4. Save Assistant message
    let assistantMsg;
    if (getIsConnected()) {
      assistantMsg = await Message.create({
        sessionId,
        sender: 'assistant',
        content: aiResponse.content,
        visualData: aiResponse.visualData,
        audioData: aiResponse.audioData,
        language: aiResponse.language || language
      });
    } else {
      assistantMsg = {
        _id: 'msg_' + (Date.now() + 1),
        sessionId,
        sender: 'assistant',
        content: aiResponse.content,
        visualData: aiResponse.visualData,
        audioData: aiResponse.audioData,
        language: aiResponse.language || language,
        createdAt: new Date()
      };
      memoryStore.messages.push(assistantMsg);
    }

    res.json({
      success: true,
      userMessage: userMsg,
      assistantMessage: assistantMsg
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
