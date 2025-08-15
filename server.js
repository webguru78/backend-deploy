// server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

// Import all routes - MAKE SURE whatsappRoutes is imported
import customerRoutes from './routes/customerRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';  // This line is crucial!

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ------------------ Configurable upload base ------------------
// Prefer explicit UPLOAD_DIR env var. Otherwise, if running on Vercel (serverless),
// use os.tmpdir() since /var/task is read-only. For local dev, use a folder inside project.
const isServerless = !!process.env.VERCEL; // Vercel sets this to "1" or "true"
const uploadBaseEnv = process.env.UPLOAD_DIR; // optional override
const defaultLocalUploads = path.join(__dirname, 'uploads');

const uploadBase = uploadBaseEnv
  ? path.resolve(uploadBaseEnv)
  : (isServerless ? path.join(os.tmpdir(), 'gym_uploads') : defaultLocalUploads);

console.log('ℹ️ Running in serverless mode:', isServerless);
console.log('ℹ️ Upload base directory:', uploadBase);

// ------------------ Middleware ------------------
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

// ------------------ Ensure directories exist (safe) ------------------
const requiredDirs = ['uploads', 'whatsapp-auth', 'logs'];
requiredDirs.forEach(dir => {
  // For each, create under uploadBase for serverless; local dev will create under project uploads folder
  const dirPath = isServerless
    ? path.join(uploadBase, dir)
    : path.join(__dirname, dir);

  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dirPath}`);
    } else {
      console.log(`ℹ️ Directory exists: ${dirPath}`);
    }
  } catch (err) {
    // If directory creation fails, log a clear message but don't crash the whole server
    console.warn(`⚠️ Could not create directory ${dirPath}. Reason:`, err && err.message ? err.message : err);
    // On serverless, we try best-effort; if you need persistent write, configure UPLOAD_DIR or external storage
  }
});

// Serve static files from the correct path (only if directory exists or is writable)
const staticUploadsPath = isServerless ? path.join(uploadBase, 'uploads') : path.join(__dirname, 'uploads');
try {
  // Protect against trying to serve a non-existent folder (express will still mount but files won't exist)
  app.use('/uploads', express.static(staticUploadsPath));
  console.log('✅ Static uploads served from:', staticUploadsPath);
} catch (err) {
  console.warn('⚠️ Failed to serve static uploads:', err && err.message ? err.message : err);
}

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ------------------ Routes Registration ------------------
console.log('🛣️ Registering routes...');

// Register WhatsApp routes FIRST (most important)
app.use('/api/whatsapp', whatsappRoutes);
console.log('✅ WhatsApp routes registered at /api/whatsapp');

// Register other routes
app.use('/api/customers', customerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);

// Legacy routes for backward compatibility
app.use('/api', customerRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', reportRoutes);

console.log('✅ All routes registered');

// ------------------ Health Check ------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    env: {
      isServerless,
      uploadBase
    },
    routes: {
      whatsapp: '/api/whatsapp',
      customers: '/api/customers',
      attendance: '/api/attendance',
      reports: '/api/reports'
    }
  });
});

// Test WhatsApp route specifically
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

// ------------------ Error Handling ------------------
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    availableRoutes: [
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
  res.status(error?.status || 500).json({
    success: false,
    message: error?.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ------------------ Database Connection ------------------
const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gym_management';
    await mongoose.connect(mongoUri, {
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

// ------------------ Start Server ------------------
const startServer = async () => {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}`);
      console.log(`📱 WhatsApp API: http://localhost:${PORT}/api/whatsapp`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log(`🧪 Test WhatsApp: http://localhost:${PORT}/test-whatsapp`);
      console.log('ℹ️ Upload base:', uploadBase);
      if (isServerless) {
        console.log('⚠️ Running serverless: uploads are ephemeral in /tmp. Consider external storage.');
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
