const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');
const argon2 = require('argon2'); // Replaced bcrypt with argon2

// User dashboard
exports.getUserDashboard = async (req, res) => {
  try {
    // Get user's tickets
    const tickets = await Ticket.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    
    // Get active chats (this is a simplified version)
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ],
      ticket: null // Only get direct messages, not ticket messages
    })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.render('user/dashboard', {
      title: 'Dashboard',
      user: req.user,
      tickets,
      messages,
      activePage: 'dashboard',
      formatTimeAgo
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'Failed to load dashboard' });
  }
};

// Admin dashboard
exports.getAdminDashboard = async (req, res) => {
  try {
    // Get tickets assigned to this admin
    const myTickets = await Ticket.find({ assignedTo: req.user._id })
      .populate('user', 'name email')
      .sort({ updatedAt: -1 });
    
    // Get open tickets
    const openTickets = await Ticket.find({ status: 'open', assignedTo: null })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get recent tickets
    const recentTickets = await Ticket.find()
      .populate('user', 'name email')
      .sort({ updatedAt: -1 })
      .limit(10);
    
    // Get active chats (simplified version)
    const chats = await Message.aggregate([
      {
        $match: {
          ticket: null,
          $or: [
            { recipient: req.user._id },
            { recipient: null } // Messages sent to all admins
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$sender',
          lastMessage: { $first: '$content' },
          updatedAt: { $first: '$createdAt' },
          unreadCount: {
            $sum: {
              $cond: [
                { $eq: ['$isRead', false] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { updatedAt: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Populate chat user details
    for (const chat of chats) {
      chat.user = await User.findById(chat._id).select('name email role');
      // Mark chat as active if there are unread messages
      chat.active = chat.unreadCount > 0;
    }
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: req.user,
      myTickets,
      openTickets,
      recentTickets,
      chats,
      activePage: 'dashboard',
      formatTime: (date) => {
        return new Date(date).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('error', { error: 'Failed to load dashboard' });
  }
};

// Head admin dashboard
exports.getHeadAdminDashboard = async (req, res) => {
  // Head admin dashboard is the same as admin dashboard with additional stats
  exports.getAdminDashboard(req, res);
};

// Waiting page for admin requesters
exports.getWaitingPage = async (req, res) => {
  try {
    res.render('user/waiting', {
      title: 'Admin Request Pending',
      user: req.user
    });
  } catch (error) {
    console.error('Waiting page error:', error);
    res.status(500).render('error', { error: 'Failed to load waiting page' });
  }
};

// User settings page
exports.getUserSettings = async (req, res) => {
  try {
    res.render('user/settings', {
      title: 'Settings',
      user: req.user,
      activePage: 'settings'
    });
  } catch (error) {
    console.error('Settings page error:', error);
    res.status(500).render('error', { error: 'Failed to load settings' });
  }
};

// Update user settings
exports.updateUserSettings = async (req, res) => {
  try {
    const { name, email, theme, chatPosition } = req.body;
    
    // Update user
    const user = await User.findById(req.user._id);
    
    user.name = name;
    user.email = email;
    
    // Update preferences
    if (!user.preferences) {
      user.preferences = {};
    }
    
    if (theme) {
      user.preferences.theme = theme;
    }
    
    if (chatPosition) {
      if (!user.preferences.layout) {
        user.preferences.layout = {};
      }
      user.preferences.layout.chatPosition = chatPosition;
    }
    
    await user.save();
    
    req.flash('success', 'Settings updated successfully');
    res.redirect('/user/settings');
  } catch (error) {
    console.error('Update settings error:', error);
    req.flash('error', 'Failed to update settings');
    res.redirect('/user/settings');
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    // Check if passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/user/settings');
    }
    
    // Get user
    const user = await User.findById(req.user._id);
    
    // Check current password
    const isMatch = await argon2.verify(user.password, currentPassword);
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/user/settings');
    }
    
    // Hash new password
    user.password = await argon2.hash(newPassword);
    
    await user.save();
    
    req.flash('success', 'Password changed successfully');
    res.redirect('/user/settings');
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error', 'Failed to change password');
    res.redirect('/user/settings');
  }
};

// Utility function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  
  // Convert milliseconds to seconds
  const seconds = Math.floor(diff / 1000);
  
  // Less than a minute
  if (seconds < 60) {
    return 'just now';
  }
  
  // Minutes
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Hours
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Days
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  
  // Default to date
  return new Date(date).toLocaleDateString();
}

// Make the formatTimeAgo function available to all controllers
exports.formatTimeAgo = formatTimeAgo;
