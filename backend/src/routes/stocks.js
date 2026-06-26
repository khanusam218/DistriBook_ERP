const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/', stockController.getAll);
router.post('/', stockController.create);
router.get('/search/:term', stockController.search);
router.get('/company/:companyName', stockController.getByCompany);
router.get('/:id', stockController.getById);
router.put('/:id', stockController.update);
router.delete('/:id', stockController.delete);

module.exports = router;
