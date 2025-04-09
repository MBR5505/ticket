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

// Create or get chat with auto-assignment
exports.createOrGetChat = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId;
    
    // If a userId is provided, get or create chat with that specific user
    if (userId) {
      return getOrCreateChat(req, res, userId);
    }
    
    // Otherwise, use auto-assignment system
    const { message, category } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required to start a chat'
      });
    }
    
    // Generate a request ID
    const requestId = new mongoose.Types.ObjectId().toString();
    
    // Return information to show the waiting page
    return res.status(200).json({
      success: true,
      status: 'queued',
      message: 'Chat request queued. You will be connected when an agent is available.',
      requestId,
      category,
      initialMessage: message
    });
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

// Find the best matching admin based on specialization and availability
async function findBestMatchingAdmin(category) {
  try {
    // First, try to find an available admin with matching specialization
    if (category) {
      const specializedAdmin = await User.findOne({
        role: { $in: ['admin', 'head_admin'] },
        status: 'available',
        specializations: category,
        $expr: { $lt: [{ $size: '$activeChats' }, '$maxConcurrentChats'] }
      });
      
      if (specializedAdmin) {
        return specializedAdmin;
      }
    }
    
    // If no specialized admin, try any available admin
    const availableAdmin = await User.findOne({
      role: { $in: ['admin', 'head_admin'] },
      status: 'available',
      $expr: { $lt: [{ $size: '$activeChats' }, '$maxConcurrentChats'] }
    });
    
    if (availableAdmin) {
      return availableAdmin;
    }
    
    // If no available admin, try any working admin
    const workingAdmin = await User.findOne({
      role: { $in: ['admin', 'head_admin'] },
      status: 'working',
      $expr: { $lt: [{ $size: '$activeChats' }, '$maxConcurrentChats'] }
    });
    
    if (workingAdmin) {
      return workingAdmin;
    }
    
    // If no working admin with space, return null (will queue the request globally)
    return null;
  } catch (error) {
    console.error('Find admin error:', error);
    return null;
  }
}

// Accept chat request
exports.acceptChatRequest = async (req, res) => {
  try {
    const { requestId, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Remove from chat queue if it exists there
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { chatQueue: { user: userId } }
    });
    
    // Add to active chats
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { activeChats: userId }
    });
    
    // Get messages between users
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: userId },
        { sender: userId, recipient: req.user._id }
      ],
      ticket: null
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'name role');
    
    // Get user details
    const user = await User.findById(userId);
    
    // Notify user that chat was accepted
    req.io.to(userId.toString()).emit('chat-request-accepted', {
      adminId: req.user._id,
      adminName: req.user.name
    });
    
    return res.status(200).json({
      success: true,
      user,
      messages
    });
  } catch (error) {
    console.error('Accept chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept chat request'
    });
  }
};

// Decline chat request
exports.declineChatRequest = async (req, res) => {
  try {
    const { requestId, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Remove from chat queue
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { chatQueue: { user: userId } }
    });
    
    // Try to find another admin
    const admin = await findBestMatchingAdmin(req.body.category);
    
    if (admin) {
      // Add to new admin's queue
      await User.findByIdAndUpdate(admin._id, {
        $push: {
          chatQueue: {
            user: userId,
            message: req.body.message,
            category: req.body.category,
            timestamp: new Date()
          }
        }
      });
      
      // Notify new admin
      req.io.to(admin._id.toString()).emit('new-chat-request', {
        requestId: new mongoose.Types.ObjectId().toString(),
        user: {
          id: userId,
          name: req.body.userName,
          email: req.body.userEmail
        },
        category: req.body.category,
        message: req.body.message
      });
      
      // Notify user
      req.io.to(userId.toString()).emit('chat-request-reassigned', {
        message: 'Your chat request is being processed by another admin.'
      });
    } else {
      // No admin available
      req.io.to(userId.toString()).emit('chat-request-failed', {
        message: 'No admin is available at the moment. Please try again later or create a ticket.'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Chat request declined successfully'
    });
  } catch (error) {
    console.error('Decline chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to decline chat request'
    });
  }
};

// End chat session
exports.endChat = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Remove from active chats
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { activeChats: userId }
    });
    
    // Notify user that chat has ended
    req.io.to(userId.toString()).emit('chat-ended', {
      adminId: req.user._id,
      adminName: req.user.name
    });
    
    return res.status(200).json({
      success: true,
      message: 'Chat ended successfully'
    });
  } catch (error) {
    console.error('End chat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to end chat'
    });
  }
};

// Get admin queue
exports.getAdminQueue = async (req, res) => {
  try {
    const admin = await User.findById(req.user._id)
      .populate('chatQueue.user', 'name email');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      queue: admin.chatQueue
    });
  } catch (error) {
    console.error('Get admin queue error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get chat queue'
    });
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Update all messages from this user to mark as read
    await Message.updateMany(
      { sender: userId, recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, message, ticketId } = req.body;
    
    // Check if there's a message or files
    if (!message && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Message content or attachments are required'
      });
    }
    
    // Create message
    const newMessage = new Message({
      content: message || '',
      sender: req.user._id,
      recipient: recipientId || null,
      ticket: ticketId || null,
      isRead: false
    });
    
    // Add attachments if any
    if (req.files && req.files.length > 0) {
      newMessage.attachments = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path.replace(/\\/g, '/').split('public/')[1] // Store relative path
      }));
    }
    
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

// Get chat waiting page
exports.getWaitingPage = async (req, res) => {
  try {
    const { requestId, category, message } = req.query;
    
    if (!requestId || !category || !message) {
      req.flash('error', 'Missing required parameters');
      return res.redirect('/user/dashboard');
    }
    
    res.render('user/chat-waiting', {
      title: 'Waiting for Support',
      user: req.user,
      requestId,
      category,
      message,
      activePage: 'messages'
    });
  } catch (error) {
    console.error('Get waiting page error:', error);
    req.flash('error', 'Failed to load waiting page');
    res.redirect('/user/dashboard');
  }
};
