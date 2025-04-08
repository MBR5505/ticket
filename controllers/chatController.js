const Message = require('../models/Message');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { formatTimeAgo } = require('./dashboardController');

// Get all messages for the current user
exports.getUserMessages = async (req, res) => {
  try {
    // Get all messages where the user is either sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ],
      ticket: null // Only get direct messages, not ticket messages
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'name role profilePicture');
    
    // Group messages by conversation
    const conversations = {};
    messages.forEach(message => {
      const otherId = message.sender._id.toString() === req.user._id.toString() 
        ? message.recipient.toString() 
        : message.sender._id.toString();
      
      if (!conversations[otherId]) {
        conversations[otherId] = {
          userId: otherId,
          messages: [],
          lastMessage: null
        };
      }
      
      conversations[otherId].messages.push(message);
      conversations[otherId].lastMessage = message;
    });
    
    // Convert to array and sort by last message time
    const sortedConversations = Object.values(conversations).sort((a, b) => {
      return b.lastMessage.createdAt - a.lastMessage.createdAt;
    });
    
    // Fetch user details for each conversation
    for (const conversation of sortedConversations) {
      conversation.user = await User.findById(conversation.userId)
        .select('name role profilePicture');
    }
    
    res.render('user/messages', {
      title: 'Messages',
      user: req.user,
      conversations: sortedConversations,
      activePage: 'messages'
    });
  } catch (error) {
    console.error('Get user messages error:', error);
    req.flash('error', 'Failed to load messages');
    res.redirect('/user/dashboard');
  }
};

// Create or get chat
exports.createOrGetChat = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId;
    
    // If no userId provided in URL, try to find an admin for new conversation
    if (!userId && !req.body.userId) {
      // Find an admin to message (first available one)
      const admin = await User.findOne({ role: { $in: ['admin', 'head_admin'] } });
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'No support agents available'
        });
      }
      
      // Get or create messages with this admin
      return getOrCreateChat(req, res, admin._id);
    }
    
    // Otherwise get or create chat with specific user
    return getOrCreateChat(req, res, userId);
  } catch (error) {
    console.error('Create or get chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get or create conversation'
    });
  }
};

// Helper function to get or create a chat between users
async function getOrCreateChat(req, res, userId) {
  try {
    // Get the user we're chatting with
    const otherUser = await User.findById(userId);
    
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get messages between current user and other user
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id }
      ],
      ticket: null // Only direct messages, not ticket messages
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'name role');
    
    // If the request is for a new conversation
    if (req.method === 'POST' && req.body.message) {
      // Create first message
      const message = new Message({
        content: req.body.message,
        sender: req.user._id,
        recipient: userId,
        ticket: null,
        isRead: false
      });
      
      await message.save();
      
      // Add to messages array
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name role');
      
      messages.push(populatedMessage);
    }
    
    return res.status(200).json({
      success: true,
      user: otherUser,
      messages
    });
  } catch (error) {
    console.error('Get or create chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get or create conversation'
    });
  }
}

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, message, ticketId } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    // Create message
    const newMessage = new Message({
      content: message,
      sender: req.user._id,
      recipient: recipientId || null,
      ticket: ticketId || null,
      isRead: false
    });
    
    await newMessage.save();
    
    // If message is associated with a ticket, update the ticket's updatedAt
    if (ticketId) {
      await Ticket.findByIdAndUpdate(ticketId, { updatedAt: Date.now() });
    }
    
    // Get populated message for response
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'name role')
      .populate('recipient', 'name role');
    
    // Emit socket event to recipient
    if (req.io) {
      req.io.to(recipientId).emit('new-message', {
        message: populatedMessage.content,
        sender: {
          id: req.user._id,
          name: req.user.name
        },
        ticket: ticketId,
        timestamp: populatedMessage.createdAt
      });
    }
    
    return res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Get messages for a ticket
exports.getTicketMessages = async (req, res) => {
  try {
    const ticketId = req.params.ticketId;
    
    // Get the ticket
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this ticket'
      });
    }
    
    // Get messages for the ticket
    const messages = await Message.find({ ticket: ticketId })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });
    
    return res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get ticket messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get ticket messages'
    });
  }
};

// Get all admin messages
exports.getAdminMessages = async (req, res) => {
  try {
    // Get conversations with all users
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { recipient: req.user._id },
            { 
              sender: req.user._id,
              recipient: { $ne: null }
            }
          ],
          ticket: null // Only direct messages, not ticket messages
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$sender', req.user._id] },
                    { $eq: ['$isRead', false] }
                  ] 
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);
    
    // Populate the conversations with user details
    const populatedConversations = [];
    
    for (const conversation of conversations) {
      // Skip conversations with null users (system messages, etc.)
      if (!conversation._id) continue;
      
      const user = await User.findById(conversation._id);
      
      if (!user) continue;
      
      // Get last message details
      const lastMessage = await Message.findById(conversation.lastMessage._id)
        .populate('sender', 'name');
      
      populatedConversations.push({
        userId: user._id,
        user: {
          name: user.name,
          email: user.email,
          role: user.role
        },
        lastMessage,
        unreadCount: conversation.unreadCount
      });
    }
    
    res.render('admin/messages', {
      title: 'User Messages',
      user: req.user,
      conversations: populatedConversations,
      activePage: 'messages',
      formatTimeAgo
    });
  } catch (error) {
    console.error('Get admin messages error:', error);
    req.flash('error', 'Failed to get messages');
    res.redirect('/admin/dashboard');
  }
};
