const db = require('../db/db');

exports.getAll = async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM stocks ORDER BY company_name, product_name').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stocks' });
  }
};

exports.getById = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM stocks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Stock not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock item' });
  }
};

exports.create = async (req, res) => {
  try {
    const { companyName, productName, productDescription, packingUnit, piecesPerCtn, purchasePrice, salePrice, quantity, barcode } = req.body;
    if (!companyName || !productName || purchasePrice == null || salePrice == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (Number(purchasePrice) < 0 || Number(salePrice) < 0) {
      return res.status(400).json({ error: 'Prices cannot be negative' });
    }
    if (quantity != null && Number(quantity) < 0) {
      return res.status(400).json({ error: 'Opening quantity cannot be negative' });
    }
    if (piecesPerCtn != null && Number(piecesPerCtn) < 1) {
      return res.status(400).json({ error: 'Pieces per carton must be at least 1' });
    }
    const result = await db.prepare(
      `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(companyName, productName, productDescription || '', packingUnit || 'Pcs', piecesPerCtn || 1, purchasePrice, salePrice, quantity || 0, barcode || '');
    const row = await db.prepare('SELECT * FROM stocks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create stock item' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, productName, productDescription, packingUnit, piecesPerCtn, purchasePrice, salePrice, quantity, barcode } = req.body;
    const existing = await db.prepare('SELECT * FROM stocks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Stock not found' });
    if (purchasePrice != null && Number(purchasePrice) < 0) return res.status(400).json({ error: 'Prices cannot be negative' });
    if (salePrice != null && Number(salePrice) < 0) return res.status(400).json({ error: 'Prices cannot be negative' });
    if (quantity != null && Number(quantity) < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
    await db.prepare(
      `UPDATE stocks SET company_name=?, product_name=?, product_description=?, packing_unit=?, pieces_per_ctn=?,
       purchase_price=?, sale_price=?, quantity=?, barcode=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      companyName ?? existing.company_name,
      productName ?? existing.product_name,
      productDescription ?? existing.product_description,
      packingUnit ?? existing.packing_unit,
      piecesPerCtn ?? existing.pieces_per_ctn,
      purchasePrice ?? existing.purchase_price,
      salePrice ?? existing.sale_price,
      quantity ?? existing.quantity,
      barcode !== undefined ? barcode : (existing.barcode || ''),
      id
    );
    res.json(await db.prepare('SELECT * FROM stocks WHERE id = ?').get(id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock item' });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM stocks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Stock not found' });
    await db.prepare('DELETE FROM stocks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Stock deleted successfully', stock: row });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock item. It may be referenced by existing transactions.' });
  }
};

exports.search = async (req, res) => {
  try {
    const term = `%${req.params.term}%`;
    const rows = await db.prepare(
      `SELECT * FROM stocks WHERE product_name LIKE ? OR product_description LIKE ? OR company_name LIKE ? ORDER BY product_name`
    ).all(term, term, term);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search stocks' });
  }
};

exports.getByCompany = async (req, res) => {
  try {
    const rows = await db.prepare('SELECT * FROM stocks WHERE company_name = ? ORDER BY product_name').all(req.params.companyName);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stocks by brand' });
  }
};
