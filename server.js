import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import all routes - MAKE SURE whatsappRoutes is imported
import customerRoutes from './routes/customerRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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

// For Vercel deployment, use /tmp for file operations
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const uploadsDir = isProduction ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// Serve static files (only works locally, not on Vercel)
if (!isProduction) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ------------------ Create directories (only for development or in /tmp) ------------------
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
    // Don't fail the application if directories can't be created
  }
};

// Only create directories if not in a read-only environment
createDirectories();

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
    environment: isProduction ? 'production' : 'development',
    uploadsDir: uploadsDir,
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
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ------------------ Database Connection ------------------
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

// ------------------ Start Server (for local development) ------------------
const startServer = async () => {
  try {
    // Connect to database first
    await connectDatabase();
    
    // Start server (only in development)
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
    if (!isProduction) {
      process.exit(1);
    }
  }
};

// Initialize the application
if (!isProduction) {
  startServer();
} else {
  // For Vercel, just connect to database
  connectDatabase().catch(console.error);
}

export default app;
