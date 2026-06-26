const express = require('express');
const router = express.Router();
const c = require('../controllers/gatePassController');

router.get('/next-ogp', c.getNextOgpNumber);
router.get('/staff', c.getStaff);
router.post('/staff', c.addStaff);
router.put('/staff/:staffId', c.updateStaff);
router.delete('/staff/:staffId', c.deleteStaff);
router.get('/areas', c.getAreas);
router.post('/areas', c.addArea);
router.delete('/areas/:areaId', c.deleteArea);
router.get('/', c.getAll);
router.post('/', c.create);

router.get('/:id/booking-items', c.getBookingItems);
router.post('/:id/booking-items', c.saveBookingItems);
router.get('/:id/consolidated', c.getConsolidated);
router.get('/:id/bill-data', c.getBillData);
router.get('/:id/returns', c.getReturns);
router.post('/:id/returns', c.createReturn);
router.get('/:id/payments', c.getPayments);
router.put('/:id/payments/:paymentId', c.updatePayment);
router.delete('/:id/payments/:paymentId', c.deletePayment);
router.patch('/:id/booking-item-rates', c.updateBookingItemRates);
router.delete('/:id/returns/:returnId', c.deleteReturn);
router.post('/:id/payment', c.recordPayment);
router.post('/:id/close', c.closeGatePass);
router.post('/:id/reopen', c.reopenGatePass);

router.get('/:id', c.getById);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;
