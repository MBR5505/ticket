const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  }
};

// Create upload directories
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const ticketUploadsDir = path.join(uploadsDir, 'tickets');
const chatUploadsDir = path.join(uploadsDir, 'chat');

createDir(ticketUploadsDir);
createDir(chatUploadsDir);

// Configure storage for ticket attachments
const ticketStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, ticketUploadsDir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Configure storage for chat attachments
const chatStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, chatUploadsDir);
  },
  filename: function(req, file, cb) {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter to limit file types
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PowerPoint
    'text/plain', 'text/csv'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, documents, and spreadsheets are allowed.'), false);
  }
};

// Create multer instances
const ticketUpload = multer({ 
  storage: ticketStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Max 5 files per upload
  }
});

const chatUpload = multer({ 
  storage: chatStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 files per message
  }
});

module.exports = {
  ticketUpload,
  chatUpload
};
