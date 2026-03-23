const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

dotenv.config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const resultRoutes = require('./routes/results');
const revaluationRoutes = require('./routes/revaluation');
const notificationRoutes = require('./routes/notifications');
const assignmentRoutes = require('./routes/assignments');
const initRoutes = require('./routes/init');
const ResultLock = require('./models/ResultLock');
const { seedDatabase } = initRoutes;

const app = express();

const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
const frontendDir = path.join(__dirname, '..', 'frontend');

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const configuredOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOriginSet = new Set([...allowedOrigins, ...configuredOrigins]);

const ensureFrontendBuild = () => {
  if (fs.existsSync(frontendBuildPath)) return true;

  const packageJsonPath = path.join(frontendDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.warn('Frontend package.json not found. Skipping UI build.');
    return false;
  }

  console.log('Frontend build not found. Building the React app now...');
  try {
    execSync('npm run build', {
      cwd: frontendDir,
      stdio: 'inherit',
      shell: true
    });
    return fs.existsSync(frontendBuildPath);
  } catch (error) {
    console.error('Frontend build failed. The API will still start, but the UI will not be served.');
    return false;
  }
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser tools or same-origin requests with no Origin header.
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOriginSet.has(origin) ||
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin) ||
        /^https:\/\/.*\.netlify\.app$/.test(origin);

      if (isAllowed) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/revaluation', revaluationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/init', initRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Express server is running!',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'IntelGrade API', version: '1.0.0' });
  });
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  ensureFrontendBuild();
  await connectDB();

  try {
    await ResultLock.collection.dropIndexes().catch(() => {});
    await ResultLock.syncIndexes();
    await ResultLock.deleteMany({ year: { $exists: false } });
  } catch (error) {
    console.error('ResultLock index sync failed:', error.message);
  }

  try {
    const seedResult = await seedDatabase({ onlyIfEmpty: true });
    if (seedResult?.skipped) {
      console.log(`Seed skipped: ${seedResult.reason}`);
    } else {
      console.log('Seed completed on startup.');
    }
  } catch (error) {
    console.error('Startup seed failed:', error.message);
  }

  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    console.log('=================================');
    console.log('Express Server Started');
    console.log(`Port: ${PORT}`);
    console.log(`Host: ${HOST}`);
    console.log('=================================');
  });
};

startServer();
