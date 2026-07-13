const express = require('express');
const router = express.Router();
const c = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/verify', authenticateJWT, c.verifyToken);
router.post('/verify-password', authenticateJWT, c.verifyPassword);

// User management — all require valid JWT; admin check is inside controller
router.get('/users', authenticateJWT, c.listUsers);
router.post('/users', authenticateJWT, c.createUser);
router.put('/users/:id', authenticateJWT, c.updateUser);
router.delete('/users/:id', authenticateJWT, c.deleteUser);

module.exports = router;
