import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all routes
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
    'http://127.0.0.1:5173',
    // Add your Vercel deployment URL here, e.g., 'https://your-project-name.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Note: Serving static files from the local file system will not work on Vercel.
// This line might cause issues. Consider using a cloud storage service like S3 or Cloudinary.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ------------------ File System Operations Removed ------------------
// The code to create directories has been removed because it is not supported
// in a Vercel serverless environment. Use external storage for uploads and logs.

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
  if (mongoose.connections[0].readyState) {
    console.log("✅ MongoDB already connected");
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    // Vercel logs this error and reports the crash, no need to `process.exit(1)`
    throw error;
  }
};

// Vercel serverless function entry point
// Connect to the database before handling the request
// The Vercel runtime will wrap this Express app and run it
app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// ------------------ Server start code removed ------------------
// app.listen() is not needed. Vercel handles starting the server.
// The `startServer()` function has been removed.

// This exports the Express app instance.
// Vercel's build process will use this as the entry point.
export default app;
