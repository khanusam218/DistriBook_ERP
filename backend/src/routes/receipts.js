const express = require('express');
const router = express.Router();
const c = require('../controllers/receiptController');

router.get('/', c.getAll);
router.post('/bulk', c.bulkCreate);
router.post('/', c.create);
router.delete('/:id', c.delete);

module.exports = router;
