const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Ticket = require('../models/Ticket');
const mongoose = require('mongoose');

module.exports = (io) => {
  // Online admins tracking
  const onlineAdmins = new Map();
  
  // Authentication middleware for socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        
        // Get user from token
        const user = await User.findById(decoded.id);
        
        if (!user) {
          return next(new Error('User not found'));
        }
        
        // Add user data to socket
        socket.user = user;
      }
      
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', async (socket) => {
    console.log('New client connected:', socket.id);
    
    // If user is authenticated, join their user ID room
    if (socket.user) {
      socket.join(socket.user._id.toString());
      console.log(`User ${socket.user.name} joined their room`);
      
      // If admin, track their online status
      if (socket.user.role === 'admin' || socket.user.role === 'head_admin') {
        onlineAdmins.set(socket.user._id.toString(), {
          socket: socket.id,
          status: socket.user.status || 'offline',
          specializations: socket.user.specializations || [],
          maxChats: socket.user.maxConcurrentChats || 3,
          activeChats: socket.user.activeChats || []
        });
        
        // If admin is coming online, update their status to available if currently offline
        if (socket.user.status === 'offline') {
          await User.findByIdAndUpdate(socket.user._id, { status: 'available' });
          socket.user.status = 'available';
          onlineAdmins.get(socket.user._id.toString()).status = 'available';
        }
        
        // Broadcast admin status change to all clients
        io.emit('admin-status-changed', {
          adminId: socket.user._id.toString(),
          status: socket.user.status
        });
      }
    }
    
    // Get support status (for clients)
    socket.on('request-support-status', async () => {
      // Count available admins
      let availableCount = 0;
      let totalAdmins = 0;
      let estimatedWaitTime = 0;
      
      // Get all admins with available or working status
      for (const [_, adminData] of onlineAdmins.entries()) {
        if (adminData.status === 'available' || adminData.status === 'working') {
          totalAdmins++;
          if (adminData.status === 'available') {
            availableCount++;
          }
        }
      }
      
      // If no admins are online, check database for any admins
      if (totalAdmins === 0) {
        const dbAdmins = await User.countDocuments({ 
          role: { $in: ['admin', 'head_admin'] },
          status: { $in: ['available', 'working'] }
        });
        
        totalAdmins = dbAdmins;
      }
      
      // Calculate estimated wait time based on available admins and current queues
      if (availableCount === 0) {
        // If no available admins, estimate based on typical chat duration
        // This is a simplified calculation - would be more complex in production
        const queueLength = await getTotalQueueLength();
        estimatedWaitTime = Math.ceil(queueLength / Math.max(totalAdmins, 1) * 5); // Assume 5 minutes per chat
      }
      
      socket.emit('support-status-update', {
        available: availableCount > 0,
        waitTime: estimatedWaitTime > 0 ? estimatedWaitTime : null
      });
    });
    
    // Admin status change
    socket.on('admin-status-change', async (data) => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      // Update admin status
      await User.findByIdAndUpdate(socket.user._id, { 
        status: data.status,
        specializations: data.specializations || socket.user.specializations
      });
      
      // Update tracking
      if (onlineAdmins.has(socket.user._id.toString())) {
        onlineAdmins.get(socket.user._id.toString()).status = data.status;
        
        if (data.specializations) {
          onlineAdmins.get(socket.user._id.toString()).specializations = data.specializations;
        }
      }
      
      // Broadcast status change to all clients
      io.emit('admin-status-changed', {
        adminId: socket.user._id.toString(),
        status: data.status
      });
    });
    
    // Get total queue length async function
    async function getTotalQueueLength() {
      try {
        const aggregation = await User.aggregate([
          { $match: { role: { $in: ['admin', 'head_admin'] } } },
          { $project: { queueLength: { $size: '$chatQueue' } } },
          { $group: { _id: null, totalQueueSize: { $sum: '$queueLength' } } }
        ]);
        
        return aggregation.length > 0 ? aggregation[0].totalQueueSize : 0;
      } catch (error) {
        console.error('Error getting queue length:', error);
        return 0;
      }
    }
    
    // User requests a chat
    socket.on('request-chat', async (data) => {
      if (!socket.user) {
        return;
      }
      
      const { message, category, requestId } = data;
      
      console.log('Chat request received:', { user: socket.user.name, category, requestId });
      
      // Find best matching admin
      let bestAdmin = null;
      let bestAdminId = null;
      
      // First try to find an available admin with matching specialization
      if (category) {
        for (const [adminId, adminData] of onlineAdmins.entries()) {
          if (adminData.status === 'available' && 
              adminData.specializations.includes(category) &&
              adminData.activeChats.length < adminData.maxChats) {
            bestAdminId = adminId;
            bestAdmin = adminData;
            break;
          }
        }
      }
      
      // If no specialized admin, try any available admin
      if (!bestAdmin) {
        for (const [adminId, adminData] of onlineAdmins.entries()) {
          if (adminData.status === 'available' &&
              adminData.activeChats.length < adminData.maxChats) {
            bestAdminId = adminId;
            bestAdmin = adminData;
            break;
          }
        }
      }
      
      // If no available admin, try working admins
      if (!bestAdmin) {
        for (const [adminId, adminData] of onlineAdmins.entries()) {
          if (adminData.status === 'working' &&
              adminData.activeChats.length < adminData.maxChats) {
            bestAdminId = adminId;
            bestAdmin = adminData;
            break;
          }
        }
      }
      
      if (bestAdmin) {
        console.log('Found best admin:', bestAdminId);
        
        // Add to admin's chat queue
        await User.findByIdAndUpdate(bestAdminId, {
          $push: {
            chatQueue: {
              user: socket.user._id,
              message,
              category,
              timestamp: new Date(),
              requestId: requestId || new mongoose.Types.ObjectId().toString()
            }
          }
        });
        
        // Send request to admin
        io.to(bestAdmin.socket).emit('new-chat-request', {
          requestId: requestId || new mongoose.Types.ObjectId().toString(),
          user: {
            id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email
          },
          category,
          message
        });
        
        // Notify user
        socket.emit('chat-request-sent', {
          requestId,
          message: 'Din forespørsel er sendt til en kundebehandler.'
        });
      } else {
        console.log('No admin available for chat');
        
        // Global queue - notify the user that no admins are available
        socket.emit('chat-request-failed', {
          message: 'Ingen kundebehandlere er tilgjengelige for øyeblikket. Vennligst prøv igjen senere eller opprett en sak.'
        });
      }
    });
    
    // Admin accepts a chat request
    socket.on('accept-chat-request', async (data) => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      const { userId, requestId } = data;
      
      console.log('Admin accepting chat:', { adminId: socket.user._id, userId, requestId });
      
      if (!userId) return;
      
      try {
        // Remove from chat queue
        await User.findByIdAndUpdate(socket.user._id, {
          $pull: { chatQueue: { user: mongoose.Types.ObjectId(userId) } }
        });
        
        // Add to active chats
        await User.findByIdAndUpdate(socket.user._id, {
          $addToSet: { activeChats: mongoose.Types.ObjectId(userId) }
        });
        
        // Notify user
        io.to(userId).emit('chat-request-accepted', {
          adminId: socket.user._id,
          adminName: socket.user.name
        });
        
        console.log('Chat accepted, notified user', userId);
      } catch (error) {
        console.error('Error accepting chat:', error);
      }
    });
    
    // Admin declines a chat request
    socket.on('decline-chat-request', async (data) => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      const { userId, requestId } = data;
      
      console.log('Admin declining chat:', { adminId: socket.user._id, userId, requestId });
      
      if (!userId) return;
      
      try {
        // Get the chat request details before removing
        const admin = await User.findById(socket.user._id);
        const chatRequest = admin.chatQueue.find(req => req.user.toString() === userId);
        
        if (!chatRequest) {
          console.log('Chat request not found in queue');
          return;
        }
        
        // Remove from this admin's chat queue
        await User.findByIdAndUpdate(socket.user._id, {
          $pull: { chatQueue: { user: mongoose.Types.ObjectId(userId) } }
        });
        
        // Try to find another admin
        let bestAdmin = null;
        let bestAdminId = null;
        
        // Search algorithm similar to the initial request
        for (const [adminId, adminData] of onlineAdmins.entries()) {
          // Skip the current admin
          if (adminId === socket.user._id.toString()) continue;
          
          if ((adminData.status === 'available' || adminData.status === 'working') &&
              adminData.activeChats.length < adminData.maxChats) {
            
            // Prefer admins with matching specialization
            if (chatRequest.category && adminData.specializations.includes(chatRequest.category)) {
              bestAdminId = adminId;
              bestAdmin = adminData;
              break;
            } else if (!bestAdmin) {
              bestAdminId = adminId;
              bestAdmin = adminData;
            }
          }
        }
        
        if (bestAdmin) {
          // Add to new admin's queue
          await User.findByIdAndUpdate(bestAdminId, {
            $push: {
              chatQueue: {
                user: mongoose.Types.ObjectId(userId),
                message: chatRequest.message,
                category: chatRequest.category,
                timestamp: new Date(),
                requestId: new mongoose.Types.ObjectId().toString()
              }
            }
          });
          
          // Notify new admin
          io.to(bestAdmin.socket).emit('new-chat-request', {
            requestId: new mongoose.Types.ObjectId().toString(),
            user: {
              id: userId,
              name: chatRequest.user.name, 
              email: chatRequest.user.email
            },
            category: chatRequest.category,
            message: chatRequest.message
          });
          
          // Notify user
          io.to(userId).emit('chat-request-reassigned', {
            message: 'Din forespørsel blir behandlet av en annen kundebehandler.'
          });
          
          console.log('Chat reassigned to new admin', bestAdminId);
        } else {
          // No admin available
          io.to(userId).emit('chat-request-failed', {
            message: 'Ingen kundebehandlere er tilgjengelige for øyeblikket. Vennligst prøv igjen senere eller opprett en sak.'
          });
          
          console.log('No available admin for reassignment');
        }
      } catch (error) {
        console.error('Error declining chat:', error);
      }
    });
    
    // End chat session
    socket.on('end-chat', async (data) => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      const { userId } = data;
      
      if (!userId) return;
      
      try {
        // Remove from active chats
        await User.findByIdAndUpdate(socket.user._id, {
          $pull: { activeChats: mongoose.Types.ObjectId(userId) }
        });
        
        // Notify user
        io.to(userId).emit('chat-ended', {
          adminId: socket.user._id,
          adminName: socket.user.name
        });
        
        console.log('Chat ended with user', userId);
      } catch (error) {
        console.error('Error ending chat:', error);
      }
    });
    
    // User cancels chat request
    socket.on('cancel-chat-request', async (data) => {
      if (!socket.user) {
        return;
      }
      
      const { requestId } = data;
      
      console.log('User canceling chat request:', { userId: socket.user._id, requestId });
      
      try {
        // Find which admin has this request in their queue
        const admins = await User.find({
          role: { $in: ['admin', 'head_admin'] },
          'chatQueue.requestId': requestId
        });
        
        // Remove from all admin queues
        for (const admin of admins) {
          await User.findByIdAndUpdate(admin._id, {
            $pull: { chatQueue: { requestId } }
          });
          
          // Notify admin
          if (onlineAdmins.has(admin._id.toString())) {
            const adminSocket = onlineAdmins.get(admin._id.toString()).socket;
            io.to(adminSocket).emit('chat-request-cancelled', {
              requestId,
              userId: socket.user._id
            });
          }
        }
        
        console.log('Chat request canceled');
      } catch (error) {
        console.error('Error canceling chat request:', error);
      }
    });
    
    // Admin dashboard status metrics
    socket.on('request-admin-metrics', async () => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      try {
        // Count online admins
        const onlineCount = onlineAdmins.size;
        
        // Get available admins
        const availableAdmins = Array.from(onlineAdmins.values()).filter(a => a.status === 'available').length;
        
        // Get working admins
        const workingAdmins = Array.from(onlineAdmins.values()).filter(a => a.status === 'working').length;
        
        // Get queue stats
        const queueSize = await getTotalQueueLength();
        
        // Get chat stats
        const activeChats = await User.aggregate([
          { $match: { role: { $in: ['admin', 'head_admin'] } } },
          { $project: { activeChatsCount: { $size: '$activeChats' } } },
          { $group: { _id: null, totalActiveChats: { $sum: '$activeChatsCount' } } }
        ]);
        
        const totalActiveChats = activeChats.length > 0 ? activeChats[0].totalActiveChats : 0;
        
        // Get open tickets count
        const openTickets = await Ticket.countDocuments({ status: 'open' });
        
        socket.emit('admin-metrics', {
          totalAdmins: onlineCount,
          onlineAdmins: onlineCount,
          availableAdmins,
          workingAdmins,
          offlineAdmins: onlineCount - availableAdmins - workingAdmins,
          queueSize,
          activeChats: totalActiveChats,
          openTickets
        });
      } catch (error) {
        console.error('Error getting admin metrics:', error);
      }
    });
    
    // Admin status list for head admin
    socket.on('request-admin-statuses', async () => {
      if (!socket.user || (socket.user.role !== 'admin' && socket.user.role !== 'head_admin')) {
        return;
      }
      
      try {
        const admins = await User.find({
          role: { $in: ['admin', 'head_admin'] }
        }).select('name email role status activeChats specializations maxConcurrentChats');
        
        // For each admin, count assigned tickets
        const adminData = [];
        
        for (const admin of admins) {
          const assignedTickets = await Ticket.countDocuments({ assignedTo: admin._id });
          
          adminData.push({
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            status: admin.status || 'offline',
            activeChats: admin.activeChats?.length || 0,
            maxChats: admin.maxConcurrentChats || 3,
            specializations: admin.specializations || [],
            assignedTickets,
            online: onlineAdmins.has(admin._id.toString())
          });
        }
        
        socket.emit('admin-statuses', {
          admins: adminData
        });
      } catch (error) {
        console.error('Error getting admin statuses:', error);
      }
    });
    
    // Handle client disconnect
    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.user && (socket.user.role === 'admin' || socket.user.role === 'head_admin')) {
        onlineAdmins.delete(socket.user._id.toString());
        
        // Set status to offline if admin leaves
        await User.findByIdAndUpdate(socket.user._id, { status: 'offline' });
        
        // Notify others
        socket.broadcast.emit('admin-status-changed', {
          adminId: socket.user._id.toString(),
          status: 'offline'
        });
      }
    });
  });
  
  return io;
};
