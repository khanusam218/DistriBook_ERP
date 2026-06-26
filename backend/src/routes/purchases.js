const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.get('/', purchaseController.getAll);
router.get('/:id', purchaseController.getById);
router.post('/', purchaseController.create);
router.put('/:id', purchaseController.update);
router.delete('/:id', purchaseController.delete);

module.exports = router;
