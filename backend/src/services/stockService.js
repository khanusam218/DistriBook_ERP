const db = require('../db/db');

async function updateStockQuantity(stockId, quantityChange) {
  await db.prepare('UPDATE stocks SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantityChange, stockId);
  return db.prepare('SELECT * FROM stocks WHERE id = ?').get(stockId);
}

async function getStockById(stockId) {
  return db.prepare('SELECT * FROM stocks WHERE id = ?').get(stockId);
}

async function reduceStockForSale(stockId, quantity) { return updateStockQuantity(stockId, -quantity); }
async function addStockForPurchase(stockId, quantity) { return updateStockQuantity(stockId, quantity); }
async function addStockForSaleReturn(stockId, quantity) { return updateStockQuantity(stockId, quantity); }
async function reduceStockForPurchaseReturn(stockId, quantity) { return updateStockQuantity(stockId, -quantity); }

module.exports = { updateStockQuantity, getStockById, reduceStockForSale, addStockForPurchase, addStockForSaleReturn, reduceStockForPurchaseReturn };
