const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { AUTH_CONFIG } = require('./config');
const db = require('./db');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getExpiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + AUTH_CONFIG.sessionDurationDays);
  return d;
}

async function register(username, password, displayName, icon) {
  // Validate username
  if (!username || !AUTH_CONFIG.usernameRegex.test(username)) {
    return { error: 'Username must be 3-16 characters (letters, numbers, underscores)' };
  }

  // Validate password
  if (!password || password.length < AUTH_CONFIG.minPasswordLength) {
    return { error: `Password must be at least ${AUTH_CONFIG.minPasswordLength} characters` };
  }
  if (password.length > AUTH_CONFIG.maxPasswordLength) {
    return { error: `Password must be at most ${AUTH_CONFIG.maxPasswordLength} characters` };
  }

  // Validate display name
  displayName = String(displayName || username).trim().slice(0, 16);
  if (!displayName) displayName = username;

  // Validate icon
  icon = icon || '\u{1F431}';

  // Check if username taken
  const existing = await db.getUserByUsername(username);
  if (existing) {
    return { error: 'Username already taken' };
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, AUTH_CONFIG.saltRounds);
  const user = await db.createUser(username, passwordHash, displayName, icon);

  // Auto-login: create session
  const token = generateToken();
  await db.createSession(token, user.id, getExpiresAt());

  return {
    user: { id: user.id, username: user.username, displayName: user.display_name, icon: user.icon },
    token,
  };
}

async function login(username, password) {
  if (!username || !password) {
    return { error: 'Username and password required' };
  }

  const user = await db.getUserByUsername(username);
  if (!user) {
    return { error: 'Invalid username or password' };
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { error: 'Invalid username or password' };
  }

  const token = generateToken();
  await db.createSession(token, user.id, getExpiresAt());

  return {
    user: { id: user.id, username: user.username, displayName: user.display_name, icon: user.icon },
    token,
  };
}

async function validateSession(token) {
  if (!token || typeof token !== 'string') return null;

  const row = await db.getSessionWithUser(token);
  if (!row) return null;

  return { id: row.user_id, username: row.username, displayName: row.display_name, icon: row.icon };
}

async function logout(token) {
  if (token) {
    await db.deleteSession(token);
  }
}

module.exports = { register, login, validateSession, logout };
