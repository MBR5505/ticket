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
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null means it's a message to all admins
  },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    default: null // null means it's a direct message, not associated with a ticket
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isSystem: {
    type: Boolean,
    default: false // true for system-generated messages
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  attachments: [AttachmentSchema]
});

// Index to speed up common queries
MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ ticket: 1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
