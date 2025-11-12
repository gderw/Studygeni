const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('../config/db');
const fs = require('fs');

// Load environment variables
dotenv.config();

// ✅ Skip creating the uploads folder on Vercel (read-only filesystem)
if (!process.env.VERCEL) {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
    console.log("📁 'uploads' directory created.");
  }
} else {
  console.log("⚠️ Skipping 'uploads' directory creation — running on Vercel (read-only file system).");
}

// Initialize express
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Conditional route loading (skip file routes on Vercel if they handle uploads)
if (!process.env.VERCEL) {
  app.use('/api/files', require('../routes/files'));
} else {
  app.use('/api/files', (req, res) => {
    res.status(403).json({ error: 'File uploads are disabled on Vercel.' });
  });
}

// Routes
app.use('/api/auth', require('../routes/auth'));

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: 'StudyGeni API is running',
    version: '1.0.0',
    environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'development'),
    endpoints: {
      auth: '/api/auth',
      files: process.env.VERCEL ? 'disabled on Vercel' : '/api/files'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
