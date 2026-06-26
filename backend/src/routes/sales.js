const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');

router.get('/', saleController.getAll);
router.get('/next-numbers', saleController.getNextNumbers);
router.get('/:id', saleController.getById);
router.post('/', saleController.create);
router.put('/:id', saleController.update);
router.delete('/:id', saleController.delete);

module.exports = router;
