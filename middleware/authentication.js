const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateUser = async (req, res, next) => {
  try {
    // Add debug logging
    console.log('Auth middleware - Cookies:', req.signedCookies);
    console.log('Auth middleware - Session:', req.session);
    
    // Check for token in cookies first
    let token;
    if (req.signedCookies.token) {
      token = req.signedCookies.token;
    } 
    // Fallback to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Add debugging
    console.log('Token found:', token ? 'Yes' : 'No');
    
    // If no token, check for active session as fallback
    if (!token && req.session.user && req.session.user.userId) {
      console.log('No token but active session found');
      // Allow access based on session
      req.user = req.session.user;
      return next();
    }
    
    // If no token and no session
    if (!token) {
      console.log('No authentication token found');
      req.flash('error', 'Authentication failed. Please log in.');
      return res.redirect('/login');
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add some delay before redirection to ensure session is set
    req.user = {
      userId: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };
    
    console.log('Token verified successfully');
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    req.flash('error', 'Authentication failed. Please log in again.');
    return res.redirect('/login');
  }
};

module.exports = authenticateUser;