const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;
  
  // Check for token in cookies
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // Also check for token in headers (for API requests)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Check if token exists
  if (!token) {
    req.flash('error', 'You must be logged in to access this page');
    return res.redirect('/auth/login');
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Get user from token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/auth/login');
    }
    
    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.flash('error', 'Not authorized, token failed');
    res.redirect('/auth/login');
  }
};

// Authorize roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      // If admin requester, redirect to waiting page
      if (req.user.role === 'admin_requester') {
        return res.redirect('/user/waiting');
      }
      
      // Otherwise redirect to appropriate dashboard
      if (req.user.role === 'user') {
        req.flash('error', 'Not authorized to access this area');
        return res.redirect('/user/dashboard');
      } else {
        req.flash('error', 'Not authorized to access this area');
        return res.redirect('/admin/dashboard');
      }
    }
    next();
  };
};

// Check if user is authenticated (for views)
exports.isAuthenticated = (req, res, next) => {
  let token;
  
  // Check for token in cookies
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  
  // Check if token exists
  if (!token) {
    return next();
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    
    // Get user from token
    User.findById(decoded.id)
      .then(user => {
        if (user) {
          // Add user to locals for views
          res.locals.user = user;
        }
        return next();
      })
      .catch(err => {
        console.error('Auth check error:', err);
        return next();
      });
  } catch (error) {
    console.error('Token verification error:', error);
    return next();
  }
};
