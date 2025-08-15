// server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// The fs and os imports are no longer needed since we are removing all file system operations.

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
    'http://127.0.0.1:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ------------------ File System Operations Removed ------------------
// All code related to fs.mkdirSync and serving static files from the local file system
// has been removed. On Vercel, use a cloud service (e.g., AWS S3) for persistent storage.

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ------------------ Routes Registration ------------------
console.log('🛣️ Registering routes...');

// Register a basic route for the root URL
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Welcome to the backend API!',
    availableRoutes: ['/health', '/api/customers', '/api/whatsapp']
  });
});

// Register WhatsApp routes
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
    timestamp: new Date().toISOString()
  });
});

// ------------------ Error Handling ------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

app.use((error, req, res) => {
  console.error('❌ Global error:', error);
  res.status(error?.status || 500).json({
    success: false,
    message: error?.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ------------------ Database Connection (Serverless-friendly) ------------------
// Use a connection flag to ensure mongoose.connect is only called once per instance.
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not set.");
    }
    await mongoose.connect(mongoUri);
    isConnected = true;
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    throw error;
  }
}

// Vercel serverless function entry point
// Connect to the database before handling the request
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// ------------------ Server start code removed ------------------
// The `startServer()` and `app.listen()` calls are removed. Vercel handles this.

export default app;
