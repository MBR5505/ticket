const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = (io) => {
  // Authentication middleware for socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      // Make authentication optional to avoid connection errors
      if (!token) {
        console.log('Socket connection without token - proceeding with limited functionality');
        return next(); // Allow connection without authentication
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      // Get user from token
      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.log('User not found for token');
        return next(); // Allow connection but without user data
      }
      
      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      // Allow connection even with authentication error
      next();
    }
  });
  
  io.on('connection', (socket) => {
    // If authenticated, join user-specific room
    if (socket.user) {
      console.log(`User connected: ${socket.user.name} (${socket.user._id})`);
      socket.join(socket.user._id.toString());
    } else {
      console.log('Anonymous socket connection established');
    }
    
    // Handle send message
    socket.on('send-message', async (data) => {
      try {
        const { recipientId, message, ticketId } = data;
        
        if (!message) {
          return;
        }
        
        // Create message
        const newMessage = new Message({
          content: message,
          sender: socket.user ? socket.user._id : null,
          recipient: recipientId || null,
          ticket: ticketId || null,
          isRead: false
        });
        
        await newMessage.save();
        
        // Emit message to recipient
        if (recipientId) {
          io.to(recipientId).emit('new-message', {
            message,
            sender: socket.user ? {
              id: socket.user._id,
              name: socket.user.name,
              role: socket.user.role
            } : null,
            ticket: ticketId,
            timestamp: new Date()
          });
        }
        
        // If admin is sending to all admins, broadcast to all admin users
        if (!recipientId && socket.user && (socket.user.role === 'admin' || socket.user.role === 'head_admin')) {
          const adminUsers = await User.find({ 
            role: { $in: ['admin', 'head_admin'] },
            _id: { $ne: socket.user._id }
          });
          
          adminUsers.forEach(admin => {
            io.to(admin._id.toString()).emit('new-message', {
              message,
              sender: {
                id: socket.user._id,
                name: socket.user.name,
                role: socket.user.role
              },
              ticket: ticketId,
              timestamp: new Date()
            });
          });
        }
      } catch (error) {
        console.error('Socket send message error:', error);
      }
    });
    
    // Handle admin request approval/denial
    socket.on('approve-admin-request', async (data) => {
      try {
        const { userId } = data;
        
        // Check if socket user is a head admin
        if (socket.user && socket.user.role !== 'head_admin') {
          return;
        }
        
        // Emit event to the user
        io.to(userId).emit('admin-request-approved', {
          message: 'Your request for admin privileges has been approved!'
        });
      } catch (error) {
        console.error('Socket approve admin request error:', error);
      }
    });
    
    socket.on('deny-admin-request', async (data) => {
      try {
        const { userId } = data;
        
        // Check if socket user is a head admin
        if (socket.user && socket.user.role !== 'head_admin') {
          return;
        }
        
        // Emit event to the user
        io.to(userId).emit('admin-request-denied', {
          message: 'Your request for admin privileges has been denied.'
        });
      } catch (error) {
        console.error('Socket deny admin request error:', error);
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.user) {
        console.log(`User disconnected: ${socket.user.name} (${socket.user._id})`);
      } else {
        console.log('Anonymous socket disconnected');
      }
    });
  });
};
