const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const logger = require('./utils/logger');


const app = express();
const session = require('express-session');

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

app.use(session({
    secret: 'nexus-super-secret-key', // In production, use env.SESSION_SECRET
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Import Routes
const adminRoutes = require('./api/routes/admin');
const authRoutes = require('./api/routes/auth');

// Protect root route (dashboard)
app.get('/', (req, res, next) => {
    if (!req.session || !req.session.isAdmin) {
        return res.sendFile(path.join(__dirname, '../public/login.html'));
    }
    next();
});

// Serve Admin Panel static files
app.use(express.static(path.join(__dirname, '../public')));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Basic API routes for the admin panel
app.get('/api/status', (req, res) => {
  res.json({ status: 'Nexus Store API is running' });
});

// Start the Express server only if not running in a serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });
}

// Export the app for Vercel serverless functions
module.exports = app;


