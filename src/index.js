require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, getIsConnected, memoryStore } = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const chatRoutes = require('./routes/chat.routes');
const quizRoutes = require('./routes/quiz.routes');
const teacherRoutes = require('./routes/teacher.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect Database (Atlas if reachable, else in-memory)
connectDB().then(() => {
  // Seed demo accounts so login always works, even without MongoDB
  seedDemoAccounts();
});

// Seed function: creates demo student + teacher if they don't exist yet
async function seedDemoAccounts() {
  const demoAccounts = [
    {
      email: 'abhinav.bca@eduvision.edu',
      name: 'Abhinav Mehta',
      password: 'password123',
      role: 'student',
      gradeLevel: 'BCA 3rd Year',
    },
    {
      email: 'prof.teacher@eduvision.edu',
      name: 'Prof. Sharma',
      password: 'teacher123',
      role: 'teacher',
      gradeLevel: 'Faculty',
    },
  ];

  if (getIsConnected()) {
    // MongoDB path: upsert into Atlas so collection is never empty
    const User = require('./models/User');
    for (const acc of demoAccounts) {
      try {
        const exists = await User.findOne({ email: acc.email });
        if (!exists) {
          await User.create({
            name: acc.name,
            email: acc.email,
            password: await bcrypt.hash(acc.password, 10),
            role: acc.role,
            gradeLevel: acc.gradeLevel,
          });
          console.log(`Demo account created in MongoDB: ${acc.email}`);
        }
      } catch (err) {
        if (err.code !== 11000) console.error('Seed error:', err.message);
      }
    }
  } else {
    // In-memory path: add to memoryStore if not present
    for (const acc of demoAccounts) {
      const existing = memoryStore.users.find((u) => u.email === acc.email);
      if (!existing) {
        memoryStore.users.push({
          _id: new mongoose.Types.ObjectId().toString(),
          name: acc.name,
          email: acc.email,
          password: await bcrypt.hash(acc.password, 10),
          role: acc.role,
          gradeLevel: acc.gradeLevel,
          createdAt: new Date(),
        });
        console.log(`Demo account seeded in memory: ${acc.email}`);
      }
    }
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/teacher', teacherRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'EduVision AI Node.js Express Gateway',
    db: getIsConnected() ? 'MongoDB Atlas' : 'In-Memory',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`EduVision AI Node.js Gateway running on port ${PORT}`);
});
