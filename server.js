// server.js (replace your file with this)
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import all routes
import customerRoutes from './routes/customerRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Robust production / Vercel detection
const isProduction = process.env.NODE_ENV === 'production'
  || process.env.VERCEL === '1'
  || process.env.VERCEL === 'true';

// uploads directory (use /tmp in production/VERCEL)
const uploadsDir = isProduction ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// CORS - you can expand origins as needed; keep it minimal in production
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads only in non-production (Vercel has read-only filesystem)
if (!isProduction) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Create directories (safe: won't throw if read-only)
const createDirectories = () => {
  try {
    const baseDir = isProduction ? '/tmp' : __dirname;
    const requiredDirs = ['uploads', 'whatsapp-auth', 'logs'];

    requiredDirs.forEach(dir => {
      const dirPath = path.join(baseDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dirPath}`);
      }
    });
  } catch (error) {
    console.warn(`⚠️ Could not create directories: ${error.message}`);
  }
};

createDirectories();

// ------------------ Register routes ------------------
console.log('🛣️ Registering routes...');
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
// legacy mounts (if you intentionally want them)
app.use('/api', customerRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);
console.log('✅ All routes registered');

// ------------------ Root + Health ------------------
// Root: useful on Vercel when user visits the base URL
app.get('/', (req, res) => {
  // respond with a friendly summary; client/browser visiting root gets redirected info
  return res.json({
    success: true,
    message: 'Welcome — API is up. See /health for details.',
    health: '/health',
    availableRoutes: [
      '/',
      '/health',
      '/test-whatsapp',
      '/api/whatsapp/status',
      '/api/customers',
      '/api/attendance',
      '/api/reports'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: isProduction ? 'production' : 'development',
    uploadsDir,
    routes: {
      root: '/',
      whatsapp: '/api/whatsapp',
      customers: '/api/customers',
      attendance: '/api/attendance',
      reports: '/api/reports'
    }
  });
});

app.get('/test-whatsapp', (req, res) => {
  res.json({
    message: 'WhatsApp route is working',
    availableEndpoints: [
      'GET /api/whatsapp/status',
      'POST /api/whatsapp/init-whatsapp-web',
      'POST /api/whatsapp/request-whatsapp-verification',
      'POST /api/whatsapp/verify-whatsapp-code',
      'POST /api/whatsapp/send-message',
      'POST /api/whatsapp/disconnect'
    ]
  });
});

// ------------------ 404 + error handlers ------------------
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: [
      '/',
      '/health',
      '/test-whatsapp',
      '/api/whatsapp/status',
      '/api/customers',
      '/api/attendance',
      '/api/reports'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('❌ Global error:', error);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ------------------ Database connection ------------------
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gym_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
    return true;
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    throw error;
  }
};

// ------------------ Start server locally only ------------------
const startServer = async () => {
  try {
    await connectDatabase();

    if (!isProduction) {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🌐 API Base URL: http://localhost:${PORT}`);
        console.log(`📱 WhatsApp API: http://localhost:${PORT}/api/whatsapp`);
        console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
        console.log(`🧪 Test WhatsApp: http://localhost:${PORT}/test-whatsapp`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (!isProduction) process.exit(1);
  }
};

if (!isProduction) {
  startServer();
} else {
  // On Vercel we just connect DB and let the serverless function handle requests
  connectDatabase().catch(console.error);
}

export default app;
