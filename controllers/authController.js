const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: '30d' }
  );
};

// Register a new user
exports.register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg);
      return res.redirect('/auth/register');
    }
    
    const { name, email, password, confirmPassword } = req.body;
    
    // Check if passwords match
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/auth/register');
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      req.flash('error', 'User with this email already exists');
      return res.redirect('/auth/register');
    }
    
    // Create the user
    const user = await User.create({
      name,
      email,
      password,
      role: req.body.requestAdmin ? 'admin_requester' : 'user'
    });
    
    // Generate token
    const token = generateToken(user._id);
    
    // Set token in cookie
    res.cookie('jwt', token, { 
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: false, // Change to false if not using HTTPS
      sameSite: 'lax' // Add this to make cookies work better across sites
    });
    
    // Set success flash message
    req.flash('success', 'Registration successful! Welcome to the Helpdesk Ticket System.');
    
    // Redirect based on role
    if (user.role === 'admin_requester') {
      res.redirect('/user/waiting');
    } else {
      res.redirect('/user/dashboard');
    }
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'An error occurred during registration');
    res.redirect('/auth/register');
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      req.flash('error', 'Please provide email and password');
      return res.redirect('/login');
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    // Create token
    const token = generateToken(user._id);
    
    // Store token in cookie with more permissive settings
    res.cookie('jwt', token, { 
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: false, // Change to false if not using HTTPS
      sameSite: 'lax' // Add this to make cookies work better across sites
    });
    
    // Create user session with essential data
    req.session.user = {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    // Add console log for debugging
    console.log('Login successful - Token generated:', token ? 'Yes' : 'No');
    
    // Redirect based on role
    if (user.role === 'head_admin' || user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/dashboard');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred. Please try again.');
    return res.redirect('/login');
  }
};

// Logout user
exports.logout = (req, res) => {
  // Clear cookie
  res.clearCookie('jwt');
  
  // Set success flash message
  req.flash('success', 'Logout successful. Come back soon!');
  
  // Redirect to login page
  res.redirect('/auth/login');
};

// Get register page
exports.getRegisterPage = (req, res) => {
  res.render('auth/register', {
    title: 'Register'
  });
};

// Get login page
exports.getLoginPage = (req, res) => {
  res.render('auth/login', {
    title: 'Login'
  });
};
