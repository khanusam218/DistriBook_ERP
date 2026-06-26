const express = require('express');
const router = express.Router();
const vendorLedgerController = require('../controllers/vendorLedgerController');

router.get('/', vendorLedgerController.getAll);
router.get('/:vendorId', vendorLedgerController.getByVendor);

module.exports = router;
