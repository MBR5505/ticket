const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');

// Middleware to redirect authenticated users
const redirectIfAuthenticated = (req, res, next) => {
  if (res.locals.user) {
    if (res.locals.user.role === 'admin_requester') {
      return res.redirect('/user/waiting');
    } else if (res.locals.user.role === 'user') {
      return res.redirect('/user/dashboard');
    } else {
      return res.redirect('/admin/dashboard');
    }
  }
  next();
};

// Apply authentication check to all routes in this router
router.use(isAuthenticated);

// Login routes
router.get('/login', redirectIfAuthenticated, authController.getLoginPage);
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], authController.login);


// Register routes
router.get('/register', redirectIfAuthenticated, authController.getRegisterPage);
router.post('/register', [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], authController.register);

// Logout route
router.get('/logout', authController.logout);

module.exports = router;
