const express = require('express');
const router = express.Router();
const saleReturnController = require('../controllers/saleReturnController');

router.get('/', saleReturnController.getAll);
router.get('/:id', saleReturnController.getById);
router.post('/', saleReturnController.create);
router.delete('/:id', saleReturnController.delete);

module.exports = router;
