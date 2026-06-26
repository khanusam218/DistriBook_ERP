const express = require('express');
const router = express.Router();
const c = require('../controllers/expenseController');

router.get('/categories', c.getCategories);
router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.delete);

module.exports = router;
