/**
 * Dashboard JavaScript
 * This file contains all the client-side functionality for the dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize navbar toggle
  initNavbarToggle();
  
  // Initialize resizable panels
  initResizablePanels();
  
  // Initialize third panel toggle
  initThirdPanelToggle();
  
  // Initialize socket connection if available
  if (typeof io !== 'undefined') {
    initializeSocket();
  }
});

// Toggle navbar expansion
function initNavbarToggle() {
  const navbarToggle = document.querySelector('.navbar-toggle');
  const navbar = document.querySelector('.navbar');
  
  if (navbarToggle && navbar) {
    navbarToggle.addEventListener('click', function() {
      navbar.classList.toggle('expanded');
    });
  }
}

// Make panels resizable
function initResizablePanels() {
  const divider = document.querySelector('.panel-divider');
  const leftPanel = document.querySelector('.panel.left-panel');
  const rightPanel = document.querySelector('.panel.right-panel');
  
  if (divider && leftPanel && rightPanel) {
    let isResizing = false;
    let startX, startWidth;
    
    divider.addEventListener('mousedown', function(e) {
      isResizing = true;
      startX = e.clientX;
      startWidth = leftPanel.offsetWidth;
      
      // Add event listeners to handle resizing
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResize);
      
      // Add resizing class to prevent text selection
      document.body.classList.add('resizing');
    });
    
    function handleMouseMove(e) {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;
      const totalWidth = leftPanel.parentElement.offsetWidth - divider.offsetWidth;
      const maxWidth = totalWidth - 300; // Minimum right panel width
      
      // Limit widths to avoid panels becoming too small
      if (newWidth >= 300 && newWidth <= maxWidth) {
        leftPanel.style.width = newWidth + 'px';
        leftPanel.style.minWidth = newWidth + 'px';
        leftPanel.style.flexGrow = 0;
        
        rightPanel.style.width = (totalWidth - newWidth) + 'px';
        rightPanel.style.minWidth = (totalWidth - newWidth) + 'px';
        rightPanel.style.flexGrow = 0;
      }
    }
    
    function stopResize() {
      isResizing = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('resizing');
    }
  }
}

// Handle third panel opening/closing
function initThirdPanelToggle() {
  const panelButtons = document.querySelectorAll('[data-panel]');
  const thirdPanel = document.querySelector('.third-panel');
  const closeButton = document.querySelector('.close-panel');
  
  if (thirdPanel && panelButtons.length > 0) {
    panelButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        
        const panelId = this.getAttribute('data-panel');
        const panelContent = document.getElementById(panelId);
        
        // Hide all panel contents and show the selected one
        document.querySelectorAll('.third-panel-content > div').forEach(div => {
          div.style.display = 'none';
        });
        
        if (panelContent) {
          panelContent.style.display = 'block';
        }
        
        // Update panel title
        const panelTitle = thirdPanel.querySelector('.panel-title');
        if (panelTitle) {
          panelTitle.textContent = this.querySelector('span').textContent;
        }
        
        // Open the panel
        thirdPanel.classList.add('open');
      });
    });
    
    // Close panel button
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        thirdPanel.classList.remove('open');
      });
    }
  }
}

// Socket.io initialization
function initializeSocket() {
  // Get token from cookie or local storage
  const token = getCookie('jwt');
  
  // Create socket connection with optional authentication
  const socket = io({
    auth: token ? { token } : {} // Only include token if it exists
  });
  
  // Connection events
  socket.on('connect', function() {
    console.log('Connected to server');
    
    // If we don't have a token, display a subtle warning for developers
    if (!token) {
      console.warn('Connected without authentication token - some features may be limited');
    }
  });
  
  socket.on('connect_error', function(error) {
    console.error('Connection error:', error);
    // Try to reconnect without token if authentication failed
    if (error.message.includes('Authentication') && token) {
      console.log('Retrying connection without authentication...');
      const anonymousSocket = io({ auth: {} });
      window.socket = anonymousSocket;
    }
  });
  
  // Handle incoming messages
  socket.on('new-message', function(data) {
    // This is handled specifically in each page's script
    if (typeof handleNewMessage === 'function') {
      handleNewMessage(data);
    }
  });
  
  // Handle ticket status updates
  socket.on('ticket-status-updated', function(data) {
    if (typeof handleTicketStatusUpdate === 'function') {
      handleTicketStatusUpdate(data);
    }
  });
  
  // Handle admin request responses
  socket.on('admin-request-approved', function(data) {
    if (window.notifications) {
      window.notifications.success(data.message || 'Your admin request has been approved!', 'Success');
    }
    
    // Redirect to admin dashboard after a short delay
    setTimeout(() => {
      window.location.href = '/admin/dashboard';
    }, 2000);
  });
  
  socket.on('admin-request-denied', function(data) {
    if (window.notifications) {
      window.notifications.error(data.message || 'Your admin request has been denied.', 'Notice');
    }
    
    // Redirect to user dashboard after a short delay
    setTimeout(() => {
      window.location.href = '/user/dashboard';
    }, 2000);
  });
  
  // Store socket for use in other scripts
  window.socket = socket;
}

// Helper function to get cookies
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// Helper function for AJAX requests
function fetchWithAuth(url, options = {}) {
  const jwt = getCookie('jwt');
  
  if (!options.headers) {
    options.headers = {};
  }
  
  options.headers['Authorization'] = `Bearer ${jwt}`;
  
  return fetch(url, options);
}
