require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const morgan = require('morgan');
const helmet = require('helmet');
const { Server } = require('socket.io');

// Database connection
const connectDB = require('./config/db');
connectDB();

// Create Express app
const app = express();
const server = http.createServer(app);

// Create Socket.io server
const io = new Server(server);
require('./socket/socket')(io);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/helpdesk',
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
  }
}));

// Flash messages
app.use(flash());

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Disabled for development
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main-layout');

// Authentication middleware to set user in res.locals
const { isAuthenticated } = require('./middleware/auth');
app.use(isAuthenticated);

// Flash messages middleware
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/', require('./routes/indexRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/user', require('./routes/dashboardRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/tickets', require('./routes/ticketRoutes'));
app.use('/chat', require('./routes/chatRoutes'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong!';
  
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    // API response
    return res.status(statusCode).json({
      success: false,
      message
    });
  }
  
  // HTML response
  res.status(statusCode).render('error', {
    title: 'Error',
    statusCode,
    message
  });
});

// 404 handler
app.use((req, res) => {
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    // API response
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
  
  // HTML response
  res.status(404).render('error', {
    title: 'Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
