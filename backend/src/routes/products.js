const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/next-code', productController.getNextCode);
router.get('/', productController.getAll);
router.get('/by-vendor/:vendorId', productController.getByVendor);
router.get('/:id', productController.getById);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.delete);

module.exports = router;
