const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// ...existing code...

// Debug middleware
const debugMiddleware = require('./middleware/debugMiddleware');
app.use(debugMiddleware);

// Cookie parser (make sure it's before session middleware)
app.use(cookieParser(process.env.SESSION_SECRET));

// CORS handling for local development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });
}

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,0 * 60 * 60 * 24 * 30, // 30 days
    resave: false,      secure: process.env.NODE_ENV === 'production',
    saveUninitialized: false,
  })
);cess.env.MONGODB_URI })

// Ensure flash messages are set up
app.use(flash());
Ensure flash messages are set up
// Flash and user middleware - add this if missingapp.use(flash());
app.use((req, res, next) => {
  res.locals.success = req.flash('success');// Flash and user middleware - add this if missing
  res.locals.error = req.flash('error');xt) => {







module.exports = app;// ...existing code...});  next();  res.locals.user = req.session.user || null;  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// ...existing code...

module.exports = app;