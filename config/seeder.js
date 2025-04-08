const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('./db');
require('dotenv').config();

// Connect to database
connectDB();

// Create initial admin user
const createHeadAdmin = async () => {
  try {
    // Check if admin already exists
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (adminExists) {
      console.log('Head admin already exists');
      return;
    }
    
    // Create head admin
    await User.create({
      name: 'System Administrator',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'head_admin'
    });
    
    console.log('Head admin created successfully');
  } catch (error) {
    console.error('Error creating head admin:', error);
  }
};

// Create seed data
const seedDatabase = async () => {
  try {
    // Create head admin
    await createHeadAdmin();
    
    // Disconnect from database
    await mongoose.disconnect();
    
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seeder
seedDatabase();
