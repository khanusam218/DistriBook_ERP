const express = require('express');
const router = express.Router();
const c = require('../controllers/companyController');

router.get('/', c.get);
router.put('/', c.update);

router.get('/delete-password-status', c.getDeletePasswordStatus);
router.post('/delete-password', c.setDeletePassword);
router.delete('/delete-password', c.removeDeletePassword);
router.post('/verify-delete-password', c.verifyDeletePassword);

module.exports = router;
