const express = require('express');
const router = express.Router();
const c = require('../controllers/vendorPaymentController');

router.get('/', c.getAll);
router.post('/', c.create);
router.delete('/:id', c.delete);

module.exports = router;
