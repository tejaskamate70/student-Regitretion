// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors()); // allow the frontend (different port) to call this API
app.use(express.json()); // parse JSON request bodies

// Connect to (or create) the database file
const db = new Database('data.db');

// This table stores every expense the user logs: what it was, how much it
// cost, which category it belongs to, and when it happened.
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
// category is expected to be one of: Food, Transport, Bills, Entertainment,
// Other. This is enforced on the frontend, not in the database schema.

// ROUTE A — POST /expenses: add a new expense
app.post('/expenses', (req, res) => {
  const { title, amount, category, date } = req.body;

  if (!title || amount == null || !category || !date) {
    return res
      .status(400)
      .json({ error: 'title, amount, category, and date are all required' });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const created_at = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO expenses (title, amount, category, date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(title, amount, category, date, created_at);

  res.status(201).json({
    id: info.lastInsertRowid,
    title,
    amount,
    category,
    date,
    created_at,
  });
});

// ROUTE B — GET /expenses: list expenses, filtered and paginated
app.get('/expenses', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { category, month } = req.query;

  // Build a WHERE clause dynamically based on which filters were provided
  const conditions = [];
  const params = [];

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }
  if (month) {
    conditions.push('date LIKE ?');
    params.push(`${month}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM expenses ${whereClause}`)
    .get(...params);
  const total = totalRow.count;

  const rows = db
    .prepare(
      `SELECT * FROM expenses ${whereClause} ORDER BY date DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({
    data: rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// ROUTE C — GET /expenses/summary: total spending per category for a month
app.get('/expenses/summary', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const rows = db
    .prepare(
      `SELECT category, SUM(amount) as total
       FROM expenses
       WHERE date LIKE ?
       GROUP BY category
       ORDER BY total DESC`
    )
    .all(`${month}%`);

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  res.json({
    month,
    categories: rows.map((r) => ({ category: r.category, total: r.total })),
    grandTotal,
  });
});

// ROUTE D — PUT /expenses/:id: edit an existing expense
app.put('/expenses/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const title = req.body.title ?? existing.title;
  const amount = req.body.amount ?? existing.amount;
  const category = req.body.category ?? existing.category;
  const date = req.body.date ?? existing.date;

  db.prepare(
    'UPDATE expenses SET title = ?, amount = ?, category = ?, date = ? WHERE id = ?'
  ).run(title, amount, category, date, id);

  res.json({ ...existing, title, amount, category, date });
});

// ROUTE E — DELETE /expenses/:id: delete an expense
app.delete('/expenses/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  res.json({ message: `Expense ${id} deleted` });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
