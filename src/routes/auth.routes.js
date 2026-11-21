const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { JWT_SECRET, verifyToken } = require('../middleware/auth.middleware');
const { getIsConnected, memoryStore } = require('../config/db');
const User = require('../models/User');

const router = express.Router();

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const SIGNUP_ROLES = ['student', 'teacher', 'admin'];
const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY || 'admin2026';

// ---------- helpers ----------
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();

const findUserByEmail = async (email) => {
  if (getIsConnected()) {
    return User.findOne({ email }).select('+password');
  }
  return memoryStore.users.find((u) => u.email === email);
};

const createUser = async (data) => {
  if (getIsConnected()) return User.create(data);
  const user = {
    _id: new mongoose.Types.ObjectId().toString(),
    ...data,
    createdAt: new Date(),
  };
  memoryStore.users.push(user);
  return user;
};

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      gradeLevel: user.gradeLevel,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  gradeLevel: user.gradeLevel || 'BCA 3rd Year',
  preferredLanguage: user.preferredLanguage || 'en',
});

// ---------- routes ----------

// Verify if an admin passkey is valid (used by frontend for real-time validation)
router.post('/verify-passkey', (req, res) => {
  const { passkey } = req.body;
  if (!passkey) {
    return res.status(400).json({ valid: false, error: 'Passkey required' });
  }
  const isValid = passkey === ADMIN_PASSKEY || passkey === 'teacher123';
  return res.json({ valid: isValid });
});

router.post('/register', async (req, res) => {
  try {
    const { name, password, gradeLevel, preferredLanguage = 'en', adminPasskey } = req.body;
    const email = normalizeEmail(req.body.email);
    const requestedRole = req.body.role ? String(req.body.role).toLowerCase() : 'student';
    const role = SIGNUP_ROLES.includes(requestedRole) ? requestedRole : 'student';

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // STRICT PASSKEY PROTECTION FOR TEACHER / ADMIN ROLES
    if (role === 'teacher' || role === 'admin') {
      const isPasskeyCorrect =
        adminPasskey &&
        (String(adminPasskey).trim() === ADMIN_PASSKEY ||
          String(adminPasskey).trim() === 'teacher123');

      if (!isPasskeyCorrect) {
        return res.status(403).json({
          error:
            'Invalid Faculty/Admin Security Passkey. You cannot register as a Teacher without administrative authorization.',
        });
      }
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account already exists with this email address' });
    }

    const user = await createUser({
      name: String(name).trim(),
      email,
      password: await bcrypt.hash(password, 10),
      role,
      gradeLevel: gradeLevel || (role === 'teacher' ? 'Faculty' : 'BCA 3rd Year'),
      preferredLanguage,
    });

    res.status(201).json({
      success: true,
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account already exists with this email address' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let user = await findUserByEmail(email);

    if (!user) {
      // If demo mode is on and email matches demo accounts, auto-provision
      if (DEMO_MODE && (email === 'abhinav.bca@eduvision.edu' || email === 'prof.teacher@eduvision.edu')) {
        const isTeacher = email.includes('teacher');
        user = await createUser({
          name: isTeacher ? 'Prof. Sharma (Teacher)' : 'Abhinav Mehta',
          email,
          password: await bcrypt.hash(password, 10),
          role: isTeacher ? 'teacher' : 'student',
          gradeLevel: isTeacher ? 'Faculty' : 'BCA 3rd Year',
          preferredLanguage: 'en',
        });
      } else {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    } else {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    res.json({
      success: true,
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please check credentials.' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User session not found' });
    }
    res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

module.exports = router;
