const db = require('../db/db');

function updateStockQuantity(stockId, quantityChange) {
  db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantityChange, stockId);
  return db.prepare('SELECT * FROM stocks WHERE id = ?').get(stockId);
}

function getStockById(stockId) {
  return db.prepare('SELECT * FROM stocks WHERE id = ?').get(stockId);
}

function reduceStockForSale(stockId, quantity) { return updateStockQuantity(stockId, -quantity); }
function addStockForPurchase(stockId, quantity) { return updateStockQuantity(stockId, quantity); }
function addStockForSaleReturn(stockId, quantity) { return updateStockQuantity(stockId, quantity); }
function reduceStockForPurchaseReturn(stockId, quantity) { return updateStockQuantity(stockId, -quantity); }

module.exports = { updateStockQuantity, getStockById, reduceStockForSale, addStockForPurchase, addStockForSaleReturn, reduceStockForPurchaseReturn };
