/**
 * Notifications JavaScript
 * Handles client-side notification functionality
 */

// Initialize the notifications system
(function() {
  // Create notification center if it doesn't exist
  let notificationCenter = document.querySelector('.notification-center');
  
  if (!notificationCenter) {
    notificationCenter = document.createElement('div');
    notificationCenter.className = 'notification-center';
    document.body.appendChild(notificationCenter);
  }
  
  // Notification types
  const types = {
    success: {
      icon: 'fas fa-check-circle',
      color: 'var(--success-color, #2ecc71)'
    },
    error: {
      icon: 'fas fa-exclamation-circle',
      color: 'var(--danger-color, #e74c3c)'
    },
    warning: {
      icon: 'fas fa-exclamation-triangle',
      color: 'var(--warning-color, #f39c12)'
    },
    info: {
      icon: 'fas fa-info-circle',
      color: 'var(--info-color, #3498db)'
    }
  };
  
  // Create a notification
  function createNotification(message, title, type = 'info', duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.borderLeftColor = types[type].color;
    
    // Create notification content
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="${types[type].icon}" style="color: ${types[type].color}"></i>
      </div>
      <div class="notification-content">
        ${title ? `<h4 class="notification-title">${title}</h4>` : ''}
        <p class="notification-message">${message}</p>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add event listener to close button
    notification.querySelector('.notification-close').addEventListener('click', function() {
      removeNotification(notification);
    });
    
    // Add to notification center
    notificationCenter.appendChild(notification);
    
    // Show notification with animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(notification);
      }, duration);
    }
    
    return notification;
  }
  
  // Remove a notification
  function removeNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
  
  // Create helper functions for each notification type
  const notifications = {
    success: function(message, title, duration) {
      return createNotification(message, title, 'success', duration);
    },
    error: function(message, title, duration) {
      return createNotification(message, title, 'error', duration);
    },
    warning: function(message, title, duration) {
      return createNotification(message, title, 'warning', duration);
    },
    info: function(message, title, duration) {
      return createNotification(message, title, 'info', duration);
    }
  };
  
  // Make available globally
  window.notifications = notifications;
})();
