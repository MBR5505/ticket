const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Message = require('../models/Message');
const { formatTimeAgo } = require('./dashboardController');

// Get user tickets
exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id })
      .sort({ updatedAt: -1 });
    
    res.render('user/tickets', {
      title: 'My Tickets',
      user: req.user,
      tickets,
      activePage: 'tickets',
      formatTimeAgo
    });
  } catch (error) {
    console.error('Get user tickets error:', error);
    req.flash('error', 'Failed to get tickets');
    res.redirect('/user/dashboard');
  }
};

// Create a new ticket
exports.createTicket = async (req, res) => {
  try {
    const { title, category, description, priority, fromChat } = req.body;
    
    // Create ticket
    const ticket = new Ticket({
      title,
      category,
      description,
      priority: priority || 'medium',
      user: req.user._id,
      status: 'open'
    });
    
    // Add history entry for creation
    ticket.history.push({
      action: 'Ticket created',
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    // If ticket created from chat, create a message to associate it
    if (fromChat) {
      // Get admin to send message to
      const admin = await User.findOne({ role: { $in: ['admin', 'head_admin'] } });
      
      // Create a message to link the ticket
      const message = new Message({
        content: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()} has been created: "${title}"`,
        sender: req.user._id,
        recipient: admin ? admin._id : null,
        ticket: ticket._id,
        isSystem: true
      });
      
      await message.save();
    }
    
    req.flash('success', 'Ticket created successfully');
    
    // If API request, return JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(201).json({ 
        success: true, 
        message: 'Ticket created successfully',
        ticketId: ticket._id
      });
    }
    
    // Otherwise redirect to ticket page
    res.redirect(`/tickets/user/${ticket._id}`);
  } catch (error) {
    console.error('Create ticket error:', error);
    
    // If API request, return JSON error
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to create ticket'
      });
    }
    
    req.flash('error', 'Failed to create ticket');
    res.redirect('/user/dashboard');
  }
};

// Get ticket by ID for user
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email')
      .populate('history.performedBy', 'name role');
    
    if (!ticket) {
      req.flash('error', 'Ticket not found');
      return res.redirect('/user/tickets');
    }
    
    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      req.flash('error', 'You do not have permission to view this ticket');
      return res.redirect('/user/tickets');
    }
    
    // Get messages for this ticket
    const messages = await Message.find({ ticket: ticket._id })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });
    
    // Get all admins for assignment dropdown (admin view only)
    let admins = [];
    if (req.user.role === 'admin' || req.user.role === 'head_admin') {
      admins = await User.find({ role: { $in: ['admin', 'head_admin'] } })
        .select('_id name email');
    }
    
    res.render('ticket/detail', {
      title: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()}`,
      user: req.user,
      ticket,
      messages,
      admins,
      activePage: 'tickets'
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    req.flash('error', 'Failed to get ticket');
    
    if (req.user.role === 'user') {
      res.redirect('/user/tickets');
    } else {
      res.redirect('/admin/tickets');
    }
  }
};

// Get all tickets (admin only)
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('user', 'name email')
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 });
    
    res.render('admin/tickets', {
      title: 'All Tickets',
      user: req.user,
      tickets,
      activePage: 'tickets'
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    req.flash('error', 'Failed to get tickets');
    res.redirect('/admin/dashboard');
  }
};

// Update ticket status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Update status
    ticket.status = status;
    
    // Add history entry
    ticket.history.push({
      action: `Status changed to ${status}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    // Create a system message about the status change
    const message = new Message({
      content: `Ticket status changed to ${status}`,
      sender: req.user._id,
      recipient: ticket.user,
      ticket: ticket._id,
      isSystem: true
    });
    
    await message.save();
    
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket status' });
  }
};

// Update ticket priority
exports.updateTicketPriority = async (req, res) => {
  try {
    const { priority } = req.body;
    
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority' });
    }
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Update priority
    ticket.priority = priority;
    
    // Add history entry
    ticket.history.push({
      action: `Priority changed to ${priority}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error('Update ticket priority error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket priority' });
  }
};

// Assign ticket to admin
exports.assignTicket = async (req, res) => {
  try {
    const { adminId } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // If adminId is empty, unassign ticket
    if (!adminId) {
      ticket.assignedTo = null;
      ticket.history.push({
        action: 'Ticket unassigned',
        performedBy: req.user._id,
        timestamp: new Date()
      });
    } else {
      // Check if admin exists
      const admin = await User.findById(adminId);
      
      if (!admin || (admin.role !== 'admin' && admin.role !== 'head_admin')) {
        return res.status(400).json({ success: false, message: 'Invalid admin' });
      }
      
      // Assign ticket
      ticket.assignedTo = adminId;
      
      // If ticket is open, set to in_progress
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      
      // Add history entry
      ticket.history.push({
        action: `Assigned to ${admin.name}`,
        performedBy: req.user._id,
        timestamp: new Date()
      });
      
      // Create a system message about the assignment
      const message = new Message({
        content: `Ticket assigned to ${admin.name}`,
        sender: req.user._id,
        recipient: ticket.user,
        ticket: ticket._id,
        isSystem: true
      });
      
      await message.save();
    }
    
    await ticket.save();
    
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign ticket' });
  }
};

// Add documentation to ticket
exports.addDocumentation = async (req, res) => {
  try {
    const { problem, solution } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Update documentation
    if (!ticket.documentation) {
      ticket.documentation = {};
    }
    
    if (problem) {
      ticket.documentation.problem = problem;
    }
    
    if (solution) {
      ticket.documentation.solution = solution;
    }
    
    // Add history entry
    ticket.history.push({
      action: 'Documentation updated',
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error('Add documentation error:', error);
    res.status(500).json({ success: false, message: 'Failed to add documentation' });
  }
};

// Get ticket statistics
exports.getStatistics = async (req, res) => {
  try {
    // This functionality is now handled by adminController.getAdminStats
    res.redirect('/admin/statistics');
  } catch (error) {
    console.error('Get statistics error:', error);
    req.flash('error', 'Failed to get statistics');
    res.redirect('/admin/dashboard');
  }
};
