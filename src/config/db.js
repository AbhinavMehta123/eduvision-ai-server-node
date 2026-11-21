const mongoose = require('mongoose');

// Memory fallback is on when ALLOW_MEMORY_FALLBACK=true OR when MONGO_URI is absent.
// It is intentionally NOT tied to the Atlas network being reachable — if Atlas
// is unreachable, the server keeps running so the app stays usable offline.
const ALLOW_MEMORY_FALLBACK =
  process.env.ALLOW_MEMORY_FALLBACK === 'true' ||
  !process.env.MONGO_URI;

const memoryStore = {
  users: [],
  sessions: [],
  messages: [],
  quizzes: [],
  attempts: [],
};

const getIsConnected = () => mongoose.connection.readyState === 1;

// Strips user:password from any connection string that appears in a message
const redact = (text) =>
  String(text).replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1***:***@');

let handlersAttached = false;
const attachEventHandlers = () => {
  if (handlersAttached) return;
  handlersAttached = true;
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', redact(err.message)));
};

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error('MONGO_URI is not set. Add it to your .env file.');
    if (!ALLOW_MEMORY_FALLBACK) process.exit(1);
    console.warn('Running with IN-MEMORY store. Nothing is saved to MongoDB.');
    return;
  }

  mongoose.set('strictQuery', false);
  attachEventHandlers();

  try {
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    // Only db name and host are printed, never the URI
    console.log(`MongoDB connected: db "${mongoose.connection.name}" on ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection FAILED:', redact(err.message));

    if (!ALLOW_MEMORY_FALLBACK) {
      console.error('Exiting. Check MONGO_URI in .env, or your Atlas IP allowlist.');
      process.exit(1);
    }
    console.warn('Running with IN-MEMORY store. Nothing is saved to MongoDB and data is lost on restart.');
  }
};

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

module.exports = { connectDB, getIsConnected, memoryStore };