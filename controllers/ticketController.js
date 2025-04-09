const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Message = require('../models/Message');
const fs = require('fs');
const path = require('path');

// Get all tickets for user
exports.getUserTickets = async (req, res) => {
  try {
    // Get tickets for current user
    const tickets = await Ticket.find({ user: req.user._id })
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });
    
    res.render('user/tickets', {
      title: 'My Tickets',
      user: req.user,
      tickets,
      activePage: 'tickets'
    });
  } catch (error) {
    console.error('Get user tickets error:', error);
    req.flash('error', 'Failed to load tickets');
    res.redirect('/user/dashboard');
  }
};

// Get all tickets for admin
exports.getAllTickets = async (req, res) => {
  try {
    // Prepare filter
    const filter = {};
    
    // Get filter parameters
    const status = req.query.status;
    const assignedTo = req.query.assigned;
    const search = req.query.search;
    
    // Apply filters
    if (status && ['open', 'in_progress', 'resolved'].includes(status)) {
      filter.status = status;
    }
    
    if (assignedTo === 'assigned') {
      filter.assignedTo = { $ne: null };
    } else if (assignedTo === 'unassigned') {
      filter.assignedTo = null;
    } else if (assignedTo === 'me') {
      filter.assignedTo = req.user._id;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get tickets with filters
    const tickets = await Ticket.find(filter)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });
    
    // Get all admins for assignment
    const admins = await User.find({ 
        role: { $in: ['admin', 'head_admin'] } 
      })
      .select('name email');
    
    res.render('admin/tickets', {
      title: 'All Tickets',
      user: req.user,
      tickets,
      admins,
      filter: { status, assignedTo, search },
      activePage: 'tickets'
    });
  } catch (error) {
    console.error('Get all tickets error:', error);
    req.flash('error', 'Failed to load tickets');
    res.redirect('/admin/dashboard');
  }
};

// Create a new ticket
exports.createTicket = async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    
    // Create new ticket
    const ticket = new Ticket({
      title,
      description,
      category,
      priority: priority || 'medium',
      user: req.user._id,
      status: 'open'
    });
    
    // Save ticket
    await ticket.save();
    
    // Process any file attachments
    if (req.files && req.files.length > 0) {
      ticket.attachments = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: `uploads/tickets/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size
      }));
      
      await ticket.save();
    }
    
    // Auto-assign ticket to the best matching admin
    await autoAssignTicket(ticket);
    
    // Redirect to ticket detail page
    if (req.headers['content-type'] === 'application/json') {
      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        ticket
      });
    } else {
      req.flash('success', 'Ticket created successfully');
      res.redirect(`/tickets/view/${ticket._id}`);
    }
  } catch (error) {
    console.error('Create ticket error:', error);
    
    if (req.headers['content-type'] === 'application/json') {
      res.status(500).json({
        success: false,
        message: 'Failed to create ticket'
      });
    } else {
      req.flash('error', 'Failed to create ticket');
      res.redirect('/user/tickets');
    }
  }
};

// Auto-assign a ticket to the best matching admin
async function autoAssignTicket(ticket) {
  try {
    // First, try to find an available admin with matching specialization
    let assignedAdmin = null;
    
    if (ticket.category) {
      assignedAdmin = await User.findOne({
        role: { $in: ['admin', 'head_admin'] },
        status: 'available',
        specializations: ticket.category
      });
    }
    
    // If no specialized admin, try any available admin
    if (!assignedAdmin) {
      assignedAdmin = await User.findOne({
        role: { $in: ['admin', 'head_admin'] },
        status: 'available'
      });
    }
    
    // If still no admin, try working admins
    if (!assignedAdmin) {
      assignedAdmin = await User.findOne({
        role: { $in: ['admin', 'head_admin'] },
        status: 'working'
      });
    }
    
    // If an admin is found, assign the ticket
    if (assignedAdmin) {
      ticket.assignedTo = assignedAdmin._id;
      ticket.status = 'in_progress';
      
      // Add history entry
      ticket.history.push({
        action: 'Auto-assigned to admin',
        performedBy: ticket.user, // The ticket creator
        timestamp: new Date()
      });
      
      await ticket.save();
      
      // Notify the admin through socket.io if possible
      const io = req.app.get('io');
      if (io) {
        io.to(assignedAdmin._id.toString()).emit('ticket-assigned', {
          ticketId: ticket._id,
          ticketTitle: ticket.title,
          autoAssigned: true
        });
      }
    }
    
    return ticket;
  } catch (error) {
    console.error('Auto-assign ticket error:', error);
    return ticket;
  }
}

// Get ticket by ID
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
    
    // If user is viewing and not admin, check permission
    if (req.user.role === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      req.flash('error', 'You do not have permission to view this ticket');
      return res.redirect('/user/tickets');
    }
    
    // Get messages for this ticket
    const messages = await Message.find({ ticket: ticket._id })
      .populate('sender', 'name role')
      .sort({ createdAt: 1 });
    
    // Get admins for assignment (if admin is viewing)
    let admins = [];
    if (req.user.role === 'admin' || req.user.role === 'head_admin') {
      admins = await User.find({ 
        role: { $in: ['admin', 'head_admin'] } 
      }).select('name email');
    }
    
    res.render('ticket/detail', {
      title: `Ticket #${ticket._id.toString().slice(-6).toUpperCase()}`,
      user: req.user,
      ticket,
      messages,
      admins,
      getFileIconClass: (mimetype) => {
        if (mimetype.startsWith('image/')) return 'fas fa-file-image';
        if (mimetype === 'application/pdf') return 'fas fa-file-pdf';
        if (mimetype.includes('word')) return 'fas fa-file-word';
        if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'fas fa-file-excel';
        if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'fas fa-file-powerpoint';
        if (mimetype.includes('text/')) return 'fas fa-file-alt';
        return 'fas fa-file';
      },
      formatFileSize: (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
      }
    });
  } catch (error) {
    console.error('Get ticket error:', error);
    req.flash('error', 'Failed to load ticket');
    res.redirect('/user/tickets');
  }
};

// Update ticket status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Update status
    ticket.status = status;
    
    // Add history entry
    ticket.history.push({
      action: `Status changed to ${status.replace('_', ' ')}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    // Add system message for status change
    await Message.create({
      content: `Ticket status changed to ${status.replace('_', ' ')}`,
      sender: req.user._id,
      ticket: ticket._id,
      isSystem: true
    });
    
    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status.replace('_', ' ')}`
    });
  } catch (error) {
    console.error('Update ticket status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket status'
    });
  }
};

// Update ticket priority
exports.updateTicketPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    
    // Validate priority
    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority value'
      });
    }
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
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
    
    // Add system message for priority change
    await Message.create({
      content: `Ticket priority changed to ${priority}`,
      sender: req.user._id,
      ticket: ticket._id,
      isSystem: true
    });
    
    return res.status(200).json({
      success: true,
      message: `Ticket priority updated to ${priority}`
    });
  } catch (error) {
    console.error('Update ticket priority error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update ticket priority'
    });
  }
};

// Assign ticket to admin
exports.assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    let adminName = 'No one';
    
    // If adminId is empty, unassign ticket
    if (!adminId) {
      ticket.assignedTo = null;
      
      // Add history entry for unassignment
      ticket.history.push({
        action: 'Ticket unassigned',
        performedBy: req.user._id,
        timestamp: new Date()
      });
    } else {
      // Get admin details
      const admin = await User.findById(adminId);
      
      if (!admin || (admin.role !== 'admin' && admin.role !== 'head_admin')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid admin selected'
        });
      }
      
      // Update ticket assignment
      ticket.assignedTo = adminId;
      
      // Update status to in_progress if currently open
      if (ticket.status === 'open') {
        ticket.status = 'in_progress';
      }
      
      // Add history entry for assignment
      ticket.history.push({
        action: `Assigned to ${admin.name}`,
        performedBy: req.user._id,
        timestamp: new Date()
      });
      
      adminName = admin.name;
    }
    
    await ticket.save();
    
    // Create system message about the assignment
    const message = new Message({
      content: adminId ? `Ticket assigned to ${adminName}` : 'Ticket unassigned',
      sender: req.user._id,
      ticket: ticket._id,
      isSystem: true
    });
    
    await message.save();
    
    // Emit socket event for real-time updates
    if (req.io) {
      // Notify the ticket owner
      req.io.to(ticket.user.toString()).emit('ticket-updated', {
        ticketId: ticket._id,
        update: 'assignment',
        assignedTo: adminId ? adminName : null
      });
      
      // If assigning to a different admin, notify them
      if (adminId && adminId !== req.user._id.toString()) {
        req.io.to(adminId).emit('ticket-assigned', {
          ticketId: ticket._id,
          ticketTitle: ticket.title,
          assignedBy: req.user.name
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: adminId ? 'Ticket assigned successfully' : 'Ticket unassigned',
      ticket
    });
  } catch (error) {
    console.error('Assign ticket error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign ticket'
    });
  }
};

// Add documentation to resolved ticket
exports.addDocumentation = async (req, res) => {
  try {
    const { id } = req.params;
    const { problem, solution } = req.body;
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Update documentation
    ticket.documentation = {
      problem: problem || '',
      solution: solution || ''
    };
    
    // Add history entry
    ticket.history.push({
      action: 'Documentation added',
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    // Add system message for documentation
    await Message.create({
      content: 'Documentation added to ticket',
      sender: req.user._id,
      ticket: ticket._id,
      isSystem: true
    });
    
    return res.status(200).json({
      success: true,
      message: 'Documentation added successfully'
    });
  } catch (error) {
    console.error('Add documentation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add documentation'
    });
  }
};

// Add attachment to ticket
exports.addAttachment = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Add attachments
    if (req.files && req.files.length > 0) {
      const newAttachments = req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path.replace(/\\/g, '/').split('public/')[1],
        uploadedBy: req.user._id
      }));
      
      ticket.attachments = [...ticket.attachments, ...newAttachments];
      
      // Add history entry
      ticket.history.push({
        action: `${req.files.length} attachment(s) added by ${req.user.name}`,
        performedBy: req.user._id,
        timestamp: new Date()
      });
      
      await ticket.save();
      
      return res.status(200).json({
        success: true,
        message: 'Attachments added successfully',
        attachments: newAttachments
      });
    } else {
      return res.status(400).json({ success: false, message: 'No files provided' });
    }
  } catch (error) {
    console.error('Add attachment error:', error);
    res.status(500).json({ success: false, message: 'Error adding attachments' });
  }
};

// Delete attachment from ticket
exports.deleteAttachment = async (req, res) => {
  try {
    const { id, attachmentId } = req.params;
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    // Check if user has access to this ticket
    if (req.user.role === 'user' && ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Find attachment index
    const attachmentIndex = ticket.attachments.findIndex(
      attachment => attachment._id.toString() === attachmentId
    );
    
    if (attachmentIndex === -1) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    
    // Get attachment path to delete file
    const attachmentPath = ticket.attachments[attachmentIndex];
    
    // Remove attachment from array
    ticket.attachments.splice(attachmentIndex, 1);
    
    // Add history entry
    ticket.history.push({
      action: `Attachment "${attachmentPath.originalname}" removed by ${req.user.name}`,
      performedBy: req.user._id,
      timestamp: new Date()
    });
    
    await ticket.save();
    
    // Try to delete file from filesystem
    try {
      const fullPath = path.join(__dirname, '..', 'public', attachmentPath.path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (deleteError) {
      console.error('Error deleting file:', deleteError);
      // Continue even if file deletion fails
    }
    
    return res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ success: false, message: 'Error deleting attachment' });
  }
};
