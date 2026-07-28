const {
  registerUser, authenticateUser, generateToken,
  getAllUsers, getUserById, updateUser, deleteUser, verifyPassword,
} = require('../services/authService');

const db = require('../db/db');

// ── Auth ──────────────────────────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { username, password, fullName, businessName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });
    const email = `${username}@distribookerp.local`;
    const user = await registerUser(username, email, password, fullName || '', 'admin', businessName || '');
    // Set business_owner_id = own id so this user gets their own isolated database
    db.authDb.prepare('UPDATE users SET business_owner_id = ? WHERE id = ?').run(user.id, user.id);
    const token = generateToken(user.id, user.username);
    let permissions = {};
    try { permissions = JSON.parse(user.permissions || '{}'); } catch {}
    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        businessName: user.business_name,
        role: user.role,
        permissions,
      },
      token,
    });
  } catch (e) {
    console.error('register error:', e);
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const user = await authenticateUser(username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user.id, user.username);

    let permissions = {};
    try { permissions = JSON.parse(user.permissions || '{}'); } catch {}

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        businessName: user.business_name || '',
        role: user.role || 'user',
        permissions,
      },
      token,
    });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const userRow = db.authDb.prepare(
      'SELECT id, username, email, full_name, business_name, role, permissions FROM users WHERE id = ?'
    ).get(req.user.userId);
    let permissions = {};
    try { permissions = JSON.parse(userRow?.permissions || '{}'); } catch {}
    res.json({
      authenticated: true,
      user: {
        id: userRow?.id,
        username: userRow?.username,
        email: userRow?.email,
        fullName: userRow?.full_name,
        businessName: userRow?.business_name || '',
        role: userRow?.role || 'user',
        permissions,
      },
    });
  } catch (e) {
    console.error('verifyToken error:', e);
    res.status(401).json({ authenticated: false, error: 'Token verification failed' });
  }
};

exports.verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });
    const ok = await verifyPassword(req.user.userId, password);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ verified: true });
  } catch (e) {
    console.error('verifyPassword error:', e);
    res.status(500).json({ error: 'Password verification failed' });
  }
};

// ── User Management (admin only) ─────────────────────────────────────────────

function requireAdmin(req, res) {
  const userRow = db.authDb.prepare('SELECT role FROM users WHERE id = ?').get(req.user?.userId);
  if (!userRow || userRow.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
}

exports.listUsers = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const users = getAllUsers().map(u => ({
      ...u,
      permissions: (() => { try { return JSON.parse(u.permissions || '{}'); } catch { return {}; } })(),
    }));
    res.json(users);
  } catch (e) { console.error('listUsers error:', e); res.status(500).json({ error: 'Failed to fetch users' }); }
};

exports.createUser = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { username, email, password, fullName, role, permissions } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    // Resolve admin's business_owner_id so sub-user inherits the same business db
    const adminRow = db.authDb.prepare('SELECT id, business_owner_id FROM users WHERE id = ?').get(req.user.userId);

    const user = await registerUser(username, email || `${username}@distribookerp.local`, password, fullName, role || 'user');

    // Sub-user always shares the exact same business context as the creating admin:
    // legacy admins (business_owner_id null) use the shared auth db as their business db,
    // so sub-users must stay null too to land in that same db, not a new isolated one.
    const inheritedOwnerId = adminRow?.business_owner_id ?? null;

    // Sub-user inherits admin's business, or gets their own isolated DB
    db.authDb.prepare('UPDATE users SET business_owner_id = ? WHERE id = ?').run(inheritedOwnerId, user.id);

    if (permissions) {
      await updateUser(user.id, { permissions });
    }
    const fresh = getUserById(user.id);
    res.status(201).json({
      ...fresh,
      permissions: (() => { try { return JSON.parse(fresh?.permissions || '{}'); } catch { return {}; } })(),
    });
  } catch (e) {
    console.error('createUser error:', e);
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { id } = req.params;
    // Prevent demoting yourself
    if (Number(id) === req.user.userId && req.body.role === 'user') {
      return res.status(400).json({ error: 'Cannot remove your own admin role' });
    }
    const updated = await updateUser(id, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json({
      ...updated,
      permissions: (() => { try { return JSON.parse(updated.permissions || '{}'); } catch { return {}; } })(),
    });
  } catch (e) { console.error('updateUser error:', e); res.status(500).json({ error: 'Failed to update user' }); }
};

exports.deleteUser = (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { id } = req.params;
    if (Number(id) === req.user.userId)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    const deleted = deleteUser(id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (e) { console.error('deleteUser error:', e); res.status(500).json({ error: 'Failed to delete user' }); }
};
