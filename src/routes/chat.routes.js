const express = require('express');
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
    if (getIsConnected()) {
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
    if (getIsConnected()) {
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

    // 2. Call Flask AI service via Axios with universal academic grade
    const aiResponse = await askAI({
      query: content,
      language,
      userGrade: req.user.gradeLevel || 'General Academic',
      includeAudio
    });

    // 3. Update session title if default
    if (getIsConnected()) {
      const session = await ChatSession.findById(sessionId);
      if (session && session.title.includes('New Learning Session')) {
        session.title = aiResponse.topic || content.slice(0, 30);
        session.updatedAt = new Date();
        await session.save();
      }
    } else {
      const session = memoryStore.sessions.find(s => s._id === sessionId);
      if (session && session.title.includes('New Learning Session')) {
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
