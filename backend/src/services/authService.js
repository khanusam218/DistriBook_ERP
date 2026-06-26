const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const JWT_EXPIRY = '7d';

async function registerUser(username, email, password, fullName, role = 'user', businessName = '') {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = db.prepare(
    `INSERT INTO users (username, email, password, full_name, is_active, role, permissions, business_name)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
  ).run(username, email, hashedPassword, fullName || '', role, '{}', businessName || '');
  return db.prepare(
    'SELECT id, username, email, full_name, is_active, role, permissions, business_name FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);
}

async function authenticateUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  const { password: _pw, ...safeUser } = user;
  return safeUser;
}

function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function getAllUsers() {
  return db.prepare(
    'SELECT id, username, email, full_name, is_active, role, permissions, business_name, created_at FROM users ORDER BY id'
  ).all();
}

function getUserById(id) {
  return db.prepare(
    'SELECT id, username, email, full_name, is_active, role, permissions, business_name FROM users WHERE id = ?'
  ).get(id);
}

async function updateUser(id, { username, email, fullName, password, role, permissions, isActive }) {
  const existing = db.prepare('SELECT id, username, email, full_name, password, role, permissions, is_active, business_name FROM users WHERE id = ?').get(id);
  if (!existing) return null;

  const hashedPassword = password ? await bcrypt.hash(password, 10) : existing.password;

  db.prepare(
    `UPDATE users SET
       username = ?, email = ?, full_name = ?, password = ?,
       role = ?, permissions = ?, is_active = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    username  ?? existing.username,
    email     ?? existing.email,
    fullName  ?? existing.full_name,
    hashedPassword,
    role        ?? existing.role,
    permissions !== undefined ? JSON.stringify(permissions) : existing.permissions,
    isActive  !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    id
  );
  return getUserById(id);
}

function deleteUser(id) {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
  if (!user) return null;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return user;
}

module.exports = {
  registerUser, authenticateUser, generateToken, verifyToken,
  getAllUsers, getUserById, updateUser, deleteUser,
};
