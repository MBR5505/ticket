/**
 * Admin Dashboard JavaScript
 * Handles admin dashboard functionality and real-time updates
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize socket connection
  const socket = io();
  
  // Listen for ticket assignments
  socket.on('ticket-assigned', function(data) {
    // Add notification for newly assigned ticket
    if (window.notifications) {
      const message = data.autoAssigned ? 
        `Sak #${data.ticketId.slice(-6).toUpperCase()} ble automatisk tildelt til deg` : 
        `Sak #${data.ticketId.slice(-6).toUpperCase()} ble tildelt til deg`;
      
      window.notifications.info(message, 'Ny sak tildelt');
    }
    
    // Refresh assigned tickets list if it exists
    refreshAssignedTickets();
  });
  
  // Listen for new chat requests
  socket.on('new-chat-request', function(data) {
    // Add notification for new chat request
    if (window.notifications) {
      window.notifications.info(`Ny chatforespørsel fra ${data.user.name}`, 'Chat-forespørsel');
    }
    
    // Add to chat queue UI if it exists
    addToChatQueue(data);
  });
  
  // Listen for admin status updates
  socket.on('admin-status-changed', function(data) {
    // Only update if this is about the current user
    if (data.adminId === document.body.getAttribute('data-user-id')) {
      updateStatusUI(data.status);
    }
  });
  
  // Initial status setup
  updateStatusUI(document.body.getAttribute('data-status') || 'offline');
});

/**
 * Update status UI
 */
function updateStatusUI(status) {
  const statusIndicator = document.querySelector('.admin-status-indicator');
  if (!statusIndicator) return;
  
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusText = statusIndicator.querySelector('.status-text');
  
  // Remove all status classes
  statusDot.classList.remove('available', 'working', 'offline');
  
  // Add new status class
  statusDot.classList.add(status);
  
  // Update text
  statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Refresh assigned tickets list
 */
function refreshAssignedTickets() {
  const ticketsContainer = document.getElementById('my-assigned-tickets');
  if (!ticketsContainer) return;
  
  // Fetch updated ticket list
  fetch('/admin/tickets/assigned')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Update tickets list
        updateTicketsList(data.tickets);
      }
    })
    .catch(error => console.error('Error refreshing tickets:', error));
}

/**
 * Update tickets list
 */
function updateTicketsList(tickets) {
  const ticketsContainer = document.getElementById('my-assigned-tickets');
  if (!ticketsContainer) return;
  
  // Clear existing tickets
  ticketsContainer.innerHTML = '';
  
  if (tickets.length === 0) {
    ticketsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-clipboard-list"></i>
        </div>
        <h3>No Assigned Tickets</h3>
        <p>You don't have any tickets assigned to you yet.</p>
      </div>
    `;
    return;
  }
  
  // Create tickets table
  const table = document.createElement('div');
  table.className = 'tickets-table-container';
  
  let tableHTML = `
    <table class="tickets-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>User</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  tickets.forEach(ticket => {
    tableHTML += `
      <tr class="ticket-row ${ticket.status}">
        <td>${ticket._id.toString().slice(-6).toUpperCase()}</td>
        <td>${ticket.title}</td>
        <td>${ticket.user.name}</td>
        <td>
          <span class="status-badge ${ticket.status}">
            ${ticket.status === 'open' ? 'Open' : 
             ticket.status === 'in_progress' ? 'In Progress' : 
             'Resolved'}
          </span>
        </td>
        <td>
          <span class="priority-badge ${ticket.priority}">
            ${ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
          </span>
        </td>
        <td>${formatTime(ticket.updatedAt)}</td>
        <td>
          <a href="/tickets/admin/${ticket._id}" class="btn btn-sm btn-primary">
            <i class="fas fa-eye"></i> View
          </a>
        </td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  table.innerHTML = tableHTML;
  ticketsContainer.appendChild(table);
}

/**
 * Add chat request to queue UI
 */
function addToChatQueue(data) {
  const queueContainer = document.getElementById('chat-queue');
  if (!queueContainer) return;
  
  // Remove empty queue message if it exists
  const emptyQueue = queueContainer.querySelector('.empty-queue');
  if (emptyQueue) {
    emptyQueue.remove();
  }
  
  // Create queue item
  const queueItem = document.createElement('div');
  queueItem.className = 'queue-item';
  queueItem.setAttribute('data-request-id', data.requestId);
  
  const categoryTranslations = {
    'technical': 'Teknisk',
    'account': 'Konto',
    'billing': 'Fakturering',
    'feature': 'Funksjon',
    'other': 'Annet'
  };
  
  const categoryText = data.category ? 
    (categoryTranslations[data.category] || data.category.charAt(0).toUpperCase() + data.category.slice(1)) : 
    'Annet';
  
  queueItem.innerHTML = `
    <div class="queue-item-header">
      <div class="queue-user-info">
        <span class="queue-user-avatar">${data.user.name.charAt(0).toUpperCase()}</span>
        <span class="queue-user-name">${data.user.name}</span>
      </div>
      <span class="queue-category category-${data.category || 'other'}">${categoryText}</span>
    </div>
    <div class="queue-item-content">${data.message}</div>
    <div class="queue-item-actions">
      <button class="btn btn-sm btn-success accept-chat">Aksepter</button>
      <button class="btn btn-sm btn-danger decline-chat">Avvis</button>
    </div>
  `;
  
  // Add event listeners
  queueItem.querySelector('.accept-chat').addEventListener('click', function() {
    acceptChatRequest(data.requestId, data.user.id);
  });
  
  queueItem.querySelector('.decline-chat').addEventListener('click', function() {
    declineChatRequest(data.requestId);
  });
  
  // Add to queue
  queueContainer.appendChild(queueItem);
  
  // Update queue count
  updateQueueCount();
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit', 
    minute: '2-digit'
  });
}
