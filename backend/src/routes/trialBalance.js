const express = require('express');
const router = express.Router();
const trialBalanceController = require('../controllers/trialBalanceController');

router.get('/', trialBalanceController.getTrialBalance);
router.get('/inventory', trialBalanceController.getInventory);
router.get('/purchases', trialBalanceController.getPurchases);
router.get('/sales', trialBalanceController.getSales);

module.exports = router;
