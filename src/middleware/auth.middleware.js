const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { getIsConnected, memoryStore } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'eduvision_production_jwt_secret_key_2026_secure';

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const DEMO_EMAIL = 'abhinav.bca@eduvision.edu';

let demoUserCache = null;

// Creates or finds the demo user - works with both MongoDB and in-memory store
async function getDemoUser() {
  if (demoUserCache) return demoUserCache;

  if (getIsConnected()) {
    // MongoDB path: upsert into Atlas
    const user = await User.findOneAndUpdate(
      { email: DEMO_EMAIL },
      {
        $setOnInsert: {
          name: 'Abhinav Mehta',
          email: DEMO_EMAIL,
          password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
          role: 'student',
          gradeLevel: 'BCA 3rd Year',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    demoUserCache = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      gradeLevel: user.gradeLevel,
    };
  } else {
    // In-memory path: find or create in memoryStore
    let user = memoryStore.users.find((u) => u.email === DEMO_EMAIL);
    if (!user) {
      user = {
        _id: new mongoose.Types.ObjectId().toString(),
        name: 'Abhinav Mehta',
        email: DEMO_EMAIL,
        password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        role: 'student',
        gradeLevel: 'BCA 3rd Year',
        createdAt: new Date(),
      };
      memoryStore.users.push(user);
    }
    demoUserCache = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      gradeLevel: user.gradeLevel,
    };
  }

  return demoUserCache;
}

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (DEMO_MODE) {
        req.user = await getDemoUser();
        return next();
      }
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (err) {
      if (DEMO_MODE) {
        req.user = await getDemoUser();
        return next();
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'admin')) {
    return res.status(403).json({ error: `Forbidden: requires ${roles.join(' or ')} role` });
  }
  next();
};

module.exports = { verifyToken, requireRole, JWT_SECRET };
