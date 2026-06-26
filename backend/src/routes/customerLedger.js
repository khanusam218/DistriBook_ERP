const express = require('express');
const router = express.Router();
const customerLedgerController = require('../controllers/customerLedgerController');

router.get('/', customerLedgerController.getAll);
router.get('/:customerId', customerLedgerController.getByCustomer);

module.exports = router;
