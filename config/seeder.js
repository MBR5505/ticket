require('dotenv').config();
const mongoose = require('mongoose');
const argon2 = require('argon2'); // Replaced bcrypt with argon2
const User = require('../models/User');
const Ticket = require('../models/Ticket');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket_system')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Create seed data
const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Ticket.deleteMany({});
    
    console.log('Previous data cleared');
    
    // Create admin user
    const adminPassword = 'admin123';
    // Note: No need to hash here as the User model will do it
    const admin = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'admin'
    });
    
    await admin.save();
    
    // Create head admin
    const headAdmin = new User({
      name: 'Head Admin',
      email: 'headadmin@example.com',
      password: 'headadmin123',
      role: 'head_admin'
    });
    
    await headAdmin.save();
    
    // Create regular user
    const user = new User({
      name: 'Regular User',
      email: 'user@example.com',
      password: 'user123'
    });
    
    await user.save();
    
    // ...existing code for creating tickets...
    
    console.log('Seed data created successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// Run the seed function
seedData();
