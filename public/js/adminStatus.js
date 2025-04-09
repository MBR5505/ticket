/**
 * Admin Status Management
 * Handles admin status changes and real-time updates
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Get user role
  const userRole = document.body.getAttribute('data-role');
  
  // Only initialize for admins
  if (userRole !== 'admin' && userRole !== 'head_admin') {
    return;
  }
  
  // Quick status toggle
  const quickToggleBtn = document.getElementById('quick-status-toggle');
  if (quickToggleBtn) {
    quickToggleBtn.addEventListener('click', function() {
      cycleStatus();
    });
  }
  
  // Status buttons
  const statusButtons = document.querySelectorAll('.status-btn');
  statusButtons.forEach(button => {
    button.addEventListener('click', function() {
      const status = this.getAttribute('data-status');
      updateStatus(status);
    });
  });
  
  // Socket event listeners
  if (typeof io !== 'undefined') {
    const socket = io();
    
    // Listen for status changes by other clients
    socket.on('admin-status-changed', function(data) {
      // Update UI if this is our status change from another tab
      if (data.adminId === document.body.getAttribute('data-user-id')) {
        updateStatusUI(data.status);
      }
    });
    
    // Make socket available globally for other scripts
    window.adminSocket = socket;
  }
});

/**
 * Cycle through statuses in order: available -> working -> offline -> available
 */
function cycleStatus() {
  const statusIndicator = document.querySelector('.admin-status-indicator .status-dot');
  if (!statusIndicator) return;
  
  let currentStatus = '';
  if (statusIndicator.classList.contains('available')) {
    currentStatus = 'available';
  } else if (statusIndicator.classList.contains('working')) {
    currentStatus = 'working';
  } else if (statusIndicator.classList.contains('offline')) {
    currentStatus = 'offline';
  }
  
  // Determine next status
  let nextStatus;
  switch (currentStatus) {
    case 'available': nextStatus = 'working'; break;
    case 'working': nextStatus = 'offline'; break;
    default: nextStatus = 'available'; break;
  }
  
  updateStatus(nextStatus);
}

/**
 * Update admin status
 * @param {string} status - The new status (available, working, offline)
 */
function updateStatus(status) {
  // Send status update to server
  fetch('/admin/settings/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update UI
        updateStatusUI(status);
        
        // Notify via socket for real-time updates
        if (window.adminSocket) {
          window.adminSocket.emit('admin-status-change', { status });
        }
        
        // Show notification
        if (window.notifications) {
          const statusMessages = {
            'available': 'Status oppdatert til tilgjengelig',
            'working': 'Status oppdatert til opptatt',
            'offline': 'Status oppdatert til frakoblet'
          };
          window.notifications.success(statusMessages[status]);
        }
      } else {
        // Show error
        if (window.notifications) {
          window.notifications.error(data.message || 'Kunne ikke oppdatere status');
        }
      }
    })
    .catch(error => {
      console.error('Error updating status:', error);
      if (window.notifications) {
        window.notifications.error('Det oppstod en feil ved oppdatering av status');
      }
    });
}

/**
 * Update the UI to reflect the current status
 * @param {string} status - The status to update UI to
 */
function updateStatusUI(status) {
  // Update status indicator in header
  const statusDot = document.querySelector('.admin-status-indicator .status-dot');
  const statusText = document.querySelector('.admin-status-indicator .status-text');
  
  if (statusDot) {
    // Remove existing status classes
    statusDot.classList.remove('available', 'working', 'offline');
    // Add new status class
    statusDot.classList.add(status);
  }
  
  if (statusText) {
    const statusTranslations = {
      'available': 'Tilgjengelig',
      'working': 'Opptatt',
      'offline': 'Frakoblet'
    };
    statusText.textContent = statusTranslations[status] || status;
  }
  
  // Update status options if on settings page
  const statusOptions = document.querySelectorAll('.status-option');
  if (statusOptions.length > 0) {
    statusOptions.forEach(option => {
      option.classList.remove('active');
      if (option.classList.contains(status)) {
        option.classList.add('active');
        option.querySelector('input[type="radio"]').checked = true;
      }
    });
  }
  
  // Update quick status buttons if on settings page
  const statusButtons = document.querySelectorAll('.status-btn');
  if (statusButtons.length > 0) {
    statusButtons.forEach(button => {
      button.disabled = button.getAttribute('data-status') === status;
    });
  }
  
  // Update status in status details section if present
  const statusValue = document.querySelector('.status-details .item-value.status-available, .status-details .item-value.status-working, .status-details .item-value.status-offline');
  if (statusValue) {
    statusValue.className = `item-value status-${status}`;
    statusValue.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }
}
