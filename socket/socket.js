const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

module.exports = (io) => {
  // Authentication middleware for socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      
      // Get user from token
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user._id})`);
    
    // Join a room based on user ID for direct messages
    socket.join(socket.user._id.toString());
    
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
          sender: socket.user._id,
          recipient: recipientId || null,
          ticket: ticketId || null,
          isRead: false
        });
        
        await newMessage.save();
        
        // Emit message to recipient
        if (recipientId) {
          io.to(recipientId).emit('new-message', {
            message,
            sender: {
              id: socket.user._id,
              name: socket.user.name,
              role: socket.user.role
            },
            ticket: ticketId,
            timestamp: new Date()
          });
        }
        
        // If admin is sending to all admins, broadcast to all admin users
        if (!recipientId && (socket.user.role === 'admin' || socket.user.role === 'head_admin')) {
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
        if (socket.user.role !== 'head_admin') {
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
        if (socket.user.role !== 'head_admin') {
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
      console.log(`User disconnected: ${socket.user.name} (${socket.user._id})`);
    });
  });
};
