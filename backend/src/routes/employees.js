const express = require('express');
const router = express.Router();
const c = require('../controllers/employeeController');

router.get('/', c.getAll);
router.post('/', c.create);
router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

// Ledger
router.get('/:id/ledger', c.getLedger);
router.post('/:id/ledger/advance', c.addAdvance);
router.post('/:id/ledger/overtime', c.addOvertime);
router.post('/:id/ledger/shortage', c.addShortage);
router.post('/:id/ledger/payment-received', c.addPaymentReceived);
router.post('/:id/ledger/recovery', c.addRecovery);
router.post('/:id/ledger/salary', c.addSalary);
router.delete('/:id/ledger/:entryId', c.deleteEntry);

module.exports = router;
