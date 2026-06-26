const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/next-code', customerController.getNextCode);
router.get('/', customerController.getAll);
router.post('/', customerController.create);
router.get('/type/:type', customerController.getByType);
router.get('/:id', customerController.getById);
router.put('/:id', customerController.update);
router.delete('/:id', customerController.delete);

module.exports = router;
