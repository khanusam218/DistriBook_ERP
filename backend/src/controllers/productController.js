const db = require('../db/db');

exports.getAll = (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT p.*, v.company_name, v.company_code FROM products p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ORDER BY v.company_name, p.product_name`
    ).all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.getById = (req, res) => {
  try {
    const row = db.prepare(
      `SELECT p.*, v.company_name, v.company_code FROM products p
       LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
    ).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.getByVendor = (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT p.*, v.company_name FROM products p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE p.vendor_id = ? ORDER BY p.product_name`
    ).all(req.params.vendorId);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.getNextCode = (req, res) => {
  try {
    const row = db.prepare('SELECT MAX(CAST(product_code AS INTEGER)) as mx FROM products').get();
    const next = String((row.mx || 0) + 1).padStart(3, '0');
    res.json({ code: next });
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.create = (req, res) => {
  try {
    const { vendorId, productName, productDescription, packingUnit, piecesPerCtn, purchasePrice, salePrice } = req.body;
    if (!vendorId || !productName) {
      return res.status(400).json({ error: 'Vendor and product name are required' });
    }
    const vendor = db.prepare('SELECT id, company_name FROM vendors WHERE id = ?').get(vendorId);
    if (!vendor) return res.status(400).json({ error: 'Vendor not found' });

    const maxRow = db.prepare('SELECT MAX(CAST(product_code AS INTEGER)) as mx FROM products').get();
    const productCode = String((maxRow.mx || 0) + 1).padStart(3, '0');

    const result = db.prepare(
      `INSERT INTO products (product_code, vendor_id, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      productCode, vendorId, productName,
      productDescription || '', packingUnit || 'CTN',
      piecesPerCtn || 1, purchasePrice || 0, salePrice || 0
    );

    // Auto-create a stock entry so this product appears in sales search
    const existing = db.prepare('SELECT id FROM stocks WHERE product_name = ? AND company_name = ?').get(productName, vendor.company_name);
    if (!existing) {
      db.prepare(
        `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(vendor.company_name, productName, productDescription || '', packingUnit || 'CTN', piecesPerCtn || 1, purchasePrice || 0, salePrice || 0);
    }

    const row = db.prepare(
      `SELECT p.*, v.company_name FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
    ).get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.update = (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, productName, productDescription, packingUnit, piecesPerCtn, purchasePrice, salePrice } = req.body;
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const oldVendor = db.prepare('SELECT company_name FROM vendors WHERE id = ?').get(existing.vendor_id);
    const newVendorId = vendorId ?? existing.vendor_id;
    const newVendor = db.prepare('SELECT company_name FROM vendors WHERE id = ?').get(newVendorId);
    const newProductName = productName ?? existing.product_name;
    const newDescription = productDescription ?? existing.product_description;
    const newPackingUnit = packingUnit ?? existing.packing_unit;
    const newPiecesPerCtn = piecesPerCtn ?? existing.pieces_per_ctn;
    const newPurchasePrice = purchasePrice ?? existing.purchase_price;
    const newSalePrice = salePrice ?? existing.sale_price;

    db.prepare(
      `UPDATE products SET vendor_id=?, product_name=?, product_description=?, packing_unit=?,
       pieces_per_ctn=?, purchase_price=?, sale_price=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(newVendorId, newProductName, newDescription, newPackingUnit, newPiecesPerCtn, newPurchasePrice, newSalePrice, id);

    // Sync the matching stock entry (matched by old name+company)
    const oldCompany = oldVendor?.company_name || '';
    const newCompany = newVendor?.company_name || oldCompany;
    const stockRow = db.prepare('SELECT id FROM stocks WHERE product_name = ? AND company_name = ?').get(existing.product_name, oldCompany);
    if (stockRow) {
      db.prepare(
        `UPDATE stocks SET product_name=?, company_name=?, product_description=?, packing_unit=?,
         pieces_per_ctn=?, purchase_price=?, sale_price=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
      ).run(newProductName, newCompany, newDescription, newPackingUnit, newPiecesPerCtn, newPurchasePrice, newSalePrice, stockRow.id);
    } else {
      // Create stock entry if it doesn't exist yet
      db.prepare(
        `INSERT INTO stocks (company_name, product_name, product_description, packing_unit, pieces_per_ctn, purchase_price, sale_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(newCompany, newProductName, newDescription, newPackingUnit, newPiecesPerCtn, newPurchasePrice, newSalePrice);
    }

    const row = db.prepare(
      `SELECT p.*, v.company_name FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id WHERE p.id = ?`
    ).get(id);
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};

exports.delete = (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Product not found' });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted', product: row });
  } catch (error) {
    res.status(500).json({ error: 'Product operation failed' });
  }
};
