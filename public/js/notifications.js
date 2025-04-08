/**
 * Notification System
 * This module provides functions to show toast notifications across the application
 */

class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }
  
  init() {
    // Create notification container if it doesn't exist
    if (!document.querySelector('.notification-center')) {
      this.container = document.createElement('div');
      this.container.className = 'notification-center';
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector('.notification-center');
    }
  }
  
  /**
   * Show a notification
   * @param {string} message - The notification message
   * @param {string} type - Type of notification: success, info, warning, error
   * @param {string} title - Optional title for the notification
   * @param {number} duration - How long to show the notification in ms (0 = don't auto-close)
   */
  show(message, type = 'info', title = '', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let iconClass = '';
    switch (type) {
      case 'success':
        iconClass = 'fa-check-circle';
        title = title || 'Success';
        break;
      case 'warning':
        iconClass = 'fa-exclamation-triangle';
        title = title || 'Warning';
        break;
      case 'error':
        iconClass = 'fa-times-circle';
        title = title || 'Error';
        break;
      default: // info
        iconClass = 'fa-info-circle';
        title = title || 'Information';
    }
    
    notification.innerHTML = `
      <div class="notification-icon">
        <i class="fas ${iconClass}"></i>
      </div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // Add to container
    this.container.appendChild(notification);
    
    // Add event listener to close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.close(notification));
    
    // Auto-close after duration (if not 0)
    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          this.close(notification);
        }
      }, duration);
    }
    
    return notification;
  }
  
  /**
   * Close a notification
   * @param {HTMLElement} notification - The notification element to close
   */
  close(notification) {
    notification.classList.add('closing');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300); // Match the animation duration
  }
  
  /**
   * Success notification shorthand
   */
  success(message, title = 'Success', duration = 5000) {
    return this.show(message, 'success', title, duration);
  }
  
  /**
   * Info notification shorthand
   */
  info(message, title = 'Information', duration = 5000) {
    return this.show(message, 'info', title, duration);
  }
  
  /**
   * Warning notification shorthand
   */
  warning(message, title = 'Warning', duration = 5000) {
    return this.show(message, 'warning', title, duration);
  }
  
  /**
   * Error notification shorthand
   */
  error(message, title = 'Error', duration = 5000) {
    return this.show(message, 'error', title, duration);
  }
}

// Create and export a singleton instance
const notifications = new NotificationSystem();

// Add to window to make globally available
window.notifications = notifications;
