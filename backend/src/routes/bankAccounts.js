const express = require('express');
const router = express.Router();
const c = require('../controllers/bankAccountController');

router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);
router.get('/:id/transactions', c.getTransactions);

module.exports = router;
