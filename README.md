# Helpdesk Ticket System

A comprehensive helpdesk support ticket management system built with Node.js, Express, MongoDB, and Socket.io.

## Features

- **User authentication and role-based access control**
  - Regular users, administrators, and head administrators
  - Admin request and approval workflow

- **Ticket Management**
  - Create, view, update, and resolve support tickets
  - Assign tickets to admins
  - Categorize tickets by type and priority
  - Documentation system for solutions

- **Real-time Communication**
  - Live chat between users and support staff
  - Real-time notifications and updates
  - Socket.io integration for instant messaging

- **Admin Tools**
  - User management
  - Performance statistics and reporting
  - Export data functionality

- **Responsive Design**
  - Works on desktop and mobile devices
  - Customizable themes (light/dark mode)

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, EJS templates
- **Backend**: Node.js, Express
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.io
- **Authentication**: JWT, bcrypt

## Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/helpdesk-ticket-system.git
   cd helpdesk-ticket-system
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/helpdesk
   JWT_SECRET=your_jwt_secret_key
   SESSION_SECRET=your_session_secret
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=adminpassword
   ```

4. Seed the database with initial data
   ```
   node config/seeder.js
   ```

5. Start the server
   ```
   npm start
   ```
   For development with automatic reloading:
   ```
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

## Usage

### User Functions

- **Registration and Login**: Create an account or login with existing credentials
- **Create Tickets**: Submit support tickets with detailed descriptions
- **Track Tickets**: View all your tickets and their current status
- **Messaging**: Communicate directly with support staff

### Admin Functions

- **Ticket Management**: View, assign, and resolve tickets
- **User Support**: Communicate with users about their tickets
- **Documentation**: Add problem descriptions and solutions for resolved tickets

### Head Admin Functions

- **User Management**: Manage users and admin access
- **System Statistics**: View performance metrics and system usage
- **Export Data**: Generate reports and export system data

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Created as a learning project for web development
- Inspired by professional helpdesk systems
