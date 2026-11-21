const axios = require('axios');

// Defaults to your live deployed Python Flask Microservice on Render
let rawFlaskUrl = process.env.FLASK_AI_URL || 'https://eduvision-ai-server-flask.onrender.com/api/ai';

rawFlaskUrl = rawFlaskUrl.trim();
if (!rawFlaskUrl.endsWith('/api/ai')) {
  rawFlaskUrl = rawFlaskUrl.replace(/\/+$/, '') + '/api/ai';
}

const FLASK_URL = rawFlaskUrl;

const flaskClient = axios.create({
  baseURL: FLASK_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const askAI = async ({ query, language = 'en', userGrade = 'General Academic', includeAudio = true }) => {
  try {
    const res = await flaskClient.post('/chat', { query, language, userGrade, includeAudio });
    return res.data.data;
  } catch (error) {
    console.error('Error calling Flask AI service:', error.message);
    throw new Error('AI Service temporarily unavailable: ' + error.message);
  }
};

const generateQuiz = async ({ topic, count = 4 }) => {
  try {
    const res = await flaskClient.post('/quiz', { topic, count });
    return res.data.data;
  } catch (error) {
    console.error('Error generating quiz:', error.message);
    throw new Error('Quiz generation failed: ' + error.message);
  }
};

const generateVisual = async ({ topic, title }) => {
  try {
    const res = await flaskClient.post('/visual', { topic, title });
    return res.data.data;
  } catch (error) {
    console.error('Error generating visual:', error.message);
    throw new Error('Visual generation failed: ' + error.message);
  }
};

module.exports = { askAI, generateQuiz, generateVisual };
