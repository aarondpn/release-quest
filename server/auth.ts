import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { AUTH_CONFIG } from './config.ts';
import * as db from './db.ts';
import type { AuthResult, AuthUser } from './types.ts';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + AUTH_CONFIG.sessionDurationDays);
  return d;
}

export async function register(username: string, password: string, displayName: string, icon?: string): Promise<AuthResult> {
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

export async function login(username: string, password: string): Promise<AuthResult> {
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

export async function validateSession(token: string): Promise<AuthUser | null> {
  if (!token || typeof token !== 'string') return null;

  const row = await db.getSessionWithUser(token);
  if (!row) return null;

  return { id: row.user_id, username: row.username, displayName: row.display_name, icon: row.icon };
}

export async function logout(token: string): Promise<void> {
  if (token) {
    await db.deleteSession(token);
  }
}
