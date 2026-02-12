// Error notification system with 3 severity levels

const ERROR_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error'
};

const ERROR_DURATION = 5000; // 5 seconds

let errorContainer = null;
let errorIdCounter = 0;

function initErrorHandler() {
  if (errorContainer) return;
  
  errorContainer = document.createElement('div');
  errorContainer.id = 'error-notifications';
  errorContainer.className = 'error-notifications';
  document.body.appendChild(errorContainer);
}

export function showError(message, level = ERROR_LEVELS.ERROR) {
  initErrorHandler();
  
  const errorId = ++errorIdCounter;
  const errorEl = document.createElement('div');
  errorEl.className = `error-notification error-${level}`;
  errorEl.dataset.errorId = errorId;
  
  const icon = getIconForLevel(level);
  errorEl.innerHTML = `
    <span class="error-icon">${icon}</span>
    <span class="error-message">${escapeHtml(message)}</span>
    <span class="error-close">×</span>
  `;
  
  // Click to dismiss
  errorEl.addEventListener('click', () => {
    dismissError(errorId);
  });
  
  errorContainer.appendChild(errorEl);
  
  // Auto-dismiss after duration
  setTimeout(() => {
    dismissError(errorId);
  }, ERROR_DURATION);
  
  return errorId;
}

function dismissError(errorId) {
  const errorEl = errorContainer.querySelector(`[data-error-id="${errorId}"]`);
  if (!errorEl) return;
  
  errorEl.classList.add('dismissing');
  setTimeout(() => {
    if (errorEl.parentNode) {
      errorEl.parentNode.removeChild(errorEl);
    }
  }, 300);
}

function getIconForLevel(level) {
  switch (level) {
    case ERROR_LEVELS.INFO:
      return 'ℹ️';
    case ERROR_LEVELS.WARNING:
      return '⚠️';
    case ERROR_LEVELS.ERROR:
      return '❌';
    default:
      return '⚠️';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export { ERROR_LEVELS };
