import { dom, clientState } from './state.js';
import { updateLobbyProfileBar } from './lobby-ui.js';

let _sendMessage = null;
export function initAuthSend(fn) { _sendMessage = fn; }

export function updateAuthUI() {
  const guestView = dom.authStatus.querySelector('.auth-guest-view');
  const loggedInView = dom.authStatus.querySelector('.auth-logged-in-view');

  if (clientState.isLoggedIn && clientState.authUser) {
    guestView.classList.add('hidden');
    loggedInView.classList.remove('hidden');
    dom.authUsername.textContent = clientState.authUser.username;
  } else {
    guestView.classList.remove('hidden');
    loggedInView.classList.add('hidden');
    dom.authUsername.textContent = '';
  }

  // Also update lobby profile bar if visible
  updateLobbyProfileBar();
}

export function showAuthOverlay() {
  dom.authOverlay.classList.remove('hidden');
  dom.authError.classList.add('hidden');
  // Default to login tab
  switchTab('login');
  dom.authLoginUsername.focus();
}

export function hideAuthOverlay() {
  dom.authOverlay.classList.add('hidden');
  clearAuthForms();
}

export function showAuthError(msg) {
  dom.authError.textContent = msg;
  dom.authError.classList.remove('hidden');
  setTimeout(() => dom.authError.classList.add('hidden'), 4000);
}

export function switchTab(tab) {
  dom.authTabs.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  if (tab === 'login') {
    dom.authLoginForm.classList.remove('hidden');
    dom.authRegisterForm.classList.add('hidden');
  } else {
    dom.authLoginForm.classList.add('hidden');
    dom.authRegisterForm.classList.remove('hidden');
  }
  dom.authError.classList.add('hidden');
}

export function submitLogin() {
  const username = dom.authLoginUsername.value.trim();
  const password = dom.authLoginPassword.value;
  console.log('submitLogin called', { username, password: password ? '***' : '', hasSendMessage: !!_sendMessage });
  if (!username || !password) {
    showAuthError('Please enter username and password');
    return;
  }
  if (_sendMessage) {
    console.log('Sending login message');
    _sendMessage({ type: 'login', username, password });
  } else {
    console.error('_sendMessage is not initialized');
    showAuthError('Login failed - connection error');
  }
}

export function submitRegister() {
  const username = dom.authRegUsername.value.trim();
  const displayName = dom.authRegDisplayName.value.trim();
  const password = dom.authRegPassword.value;
  const confirm = dom.authRegConfirm.value;

  if (!username) {
    showAuthError('Please enter a username');
    return;
  }
  if (!password) {
    showAuthError('Please enter a password');
    return;
  }
  if (password.length < 6) {
    showAuthError('Password must be at least 6 characters');
    return;
  }
  if (password !== confirm) {
    showAuthError('Passwords do not match');
    return;
  }

  const icon = clientState.selectedIcon || undefined;
  if (_sendMessage) _sendMessage({ type: 'register', username, password, displayName: displayName || username, icon });
}

export function submitLogout() {
  const token = clientState.authToken;
  if (_sendMessage) _sendMessage({ type: 'logout', token });
}

function clearAuthForms() {
  dom.authLoginUsername.value = '';
  dom.authLoginPassword.value = '';
  dom.authRegUsername.value = '';
  dom.authRegDisplayName.value = '';
  dom.authRegPassword.value = '';
  dom.authRegConfirm.value = '';
  dom.authError.classList.add('hidden');
}
