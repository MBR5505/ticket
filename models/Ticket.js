const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  originalname: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const TicketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    required: [true, 'Please provide a category'],
    enum: ['technical', 'account', 'billing', 'feature', 'other']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide a user']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  history: [
    {
      action: {
        type: String,
        required: true
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  documentation: {
    problem: {
      type: String,
      default: ''
    },
    solution: {
      type: String,
      default: ''
    }
  },
  attachments: [AttachmentSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
TicketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);
