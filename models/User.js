const mongoose = require('mongoose');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email',
    ],
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'head_admin'],
    default: 'user',
  },
  profilePicture: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  
  // Admin status for availability
  status: {
    type: String,
    enum: ['available', 'working', 'offline'],
    default: 'offline'
  },
  
  // Admin specializations for auto-routing
  specializations: [{
    type: String,
    enum: ['technical', 'account', 'billing', 'feature', 'other']
  }],
  
  // Admin chat queue for pending requests
  chatQueue: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    category: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    requestId: String
  }],
  
  // Active chat sessions
  activeChats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Maximum concurrent chats an admin can handle
  maxConcurrentChats: {
    type: Number,
    default: 3,
    min: 1,
    max: 10
  },
  
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  try {
    this.password = await argon2.hash(this.password, {
      type: argon2.argon2id,
      memoryCost: 2**16, // 64 MiB
      timeCost: 3,       // 3 iterations
      parallelism: 1     // 1 degree of parallelism
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await argon2.verify(this.password, candidatePassword);
  } catch (error) {
    console.error('Error comparing password:', error);
    return false;
  }
};

// Generate JWT
UserSchema.methods.createJWT = function() {
  return jwt.sign(
    { id: this._id, name: this.name, role: this.role },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: process.env.JWT_LIFETIME || '30d' }
  );
};

module.exports = mongoose.model('User', UserSchema);
