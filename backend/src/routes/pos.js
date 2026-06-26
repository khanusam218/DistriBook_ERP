const express = require('express');
const router = express.Router();
const c = require('../controllers/posController');

router.get('/products', c.getProducts);
router.get('/bills', c.getBills);
router.get('/bills/:id', c.getBill);
router.post('/sale', c.createSale);

module.exports = router;
