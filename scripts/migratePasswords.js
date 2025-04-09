require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Store the original comparePassword method
const originalComparePassword = User.schema.methods.comparePassword;

// Temporarily add a bcrypt compare method for migration
User.schema.methods.compareBcryptPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

async function migratePasswords() {
  try {
    console.log('Starting password migration...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    // Set a test password for testing bcrypt passwords
    const testPassword = 'password123';
    
    for (const user of users) {
      try {
        // Test if password is already in argon2 format (starts with $argon2)
        if (user.password.startsWith('$argon2')) {
          console.log(`User ${user.email} already using argon2, skipping.`);
          continue;
        }
        
        // For real-world applications, you would need a way to get the plain password
        // Since we don't have that, this script is just a demonstration
        // You might want to implement a password reset for all users instead
        
        console.log(`Migrating password for user: ${user.email}`);
        
        // Option 1: Reset to a default password (users would need to reset their passwords)
        const newPassword = await argon2.hash(testPassword, {
          type: argon2.argon2id,
          memoryCost: 2**16,
          timeCost: 3,
          parallelism: 1
        });
        
        user.password = newPassword;
        await user.save();
        
        console.log(`Successfully migrated password for ${user.email}`);
      } catch (error) {
        console.error(`Error migrating password for user ${user.email}:`, error);
      }
    }
    
    console.log('Password migration completed.');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    mongoose.disconnect();
  }
}

migratePasswords();
