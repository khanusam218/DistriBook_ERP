const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');

router.get('/', vendorController.getAll);
router.get('/:id', vendorController.getById);
router.post('/', vendorController.create);
router.put('/:id', vendorController.update);
router.delete('/:id', vendorController.delete);

module.exports = router;
