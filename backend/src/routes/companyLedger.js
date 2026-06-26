const express = require('express');
const router = express.Router();
const companyLedgerController = require('../controllers/companyLedgerController');

router.get('/', companyLedgerController.getAll);
router.post('/', companyLedgerController.create);
router.get('/:accountName', companyLedgerController.getByAccount);

module.exports = router;
