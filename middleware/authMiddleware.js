const jwt = require('jsonwebtoken');

exports.protect = (req, res, next) => {
  // Debug cookie information
  console.log('Cookies:', req.cookies);

  const token = req.cookies.jwt;
  
  if (!token) {
    console.log('No JWT cookie found');
    req.flash('error', 'Please log in to access this page');
    return res.redirect('/auth/login');
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    console.log('JWT verified successfully:', decoded);
    
    // Add user info to request
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    req.flash('error', 'Session expired. Please log in again.');
    res.redirect('/auth/login');
  }
};
