const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// ...existing code...

// Cookie parser setup
app.use(cookieParser(process.env.SESSION_SECRET));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    },
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
  })
);

// Ensure flash messages are set up
app.use(flash());

// Flash and user middleware - add this if missing
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// ...existing code...

module.exports = app;