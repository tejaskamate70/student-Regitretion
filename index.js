// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize connection to database file named data.db
const db = new Database('data.db');

// Create the habits table if it does not already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

// Create the checkins table if it does not already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`);

/**
 * Calculates the current consecutive daily streak for a specific habit ID.
 * Logic: Reads all check-ins for the habit ordered by date descending. Starts checking from today.
 * If today has no check-in and yesterday also has no check-in, the streak is broken (0).
 * If today is missing but yesterday has a check-in, the streak counts backwards starting from yesterday.
 * Otherwise, it counts every consecutive day backwards that has a valid check-in row.
 */
function calculateStreak(habitId) {
  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  const checkinDates = new Set(rows.map(r => r.date));

  const now = new Date();
  // Simple YYYY-MM-DD formatting matching local time
  const format = (d) => d.toISOString().split('T')[0];
  
  let todayStr = format(now);
  let yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  let yesterdayStr = format(yesterday);

  if (!checkinDates.has(todayStr) && !checkinDates.has(yesterdayStr)) {
    return 0;
  }

  let streak = 0;
  let currentCheckDate = new Date(now);
  
  if (!checkinDates.has(todayStr) && checkinDates.has(yesterdayStr)) {
    currentCheckDate = yesterday;
  }

  while (true) {
    let dateStr = format(currentCheckDate);
    if (checkinDates.has(dateStr)) {
      streak++;
      currentCheckDate.setDate(currentCheckDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// ROUTE A — POST /habits: Creates a new habit and returns it with a starting streak of 0
app.post('/habits', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const createdAt = new Date().toISOString();
  const info = db.prepare('INSERT INTO habits (name, created_at) VALUES (?, ?)').run(name.trim(), createdAt);
  res.status(201).json({
    id: info.lastInsertRowid,
    name: name.trim(),
    created_at: createdAt,
    streak: 0
  });
});

// ROUTE B — GET /habits: Lists all habits ordered by creation date along with their current streaks
app.get('/habits', (req, res) => {
  const habits = db.prepare('SELECT * FROM habits ORDER BY created_at ASC').all();
  for (let habit of habits) {
    habit.streak = calculateStreak(habit.id);
  }
  res.status(200).json(habits);
});

// ROUTE C — POST /habits/:id/checkin: Marks a habit as done for a specific date or defaults to today
app.post('/habits/:id/checkin', (req, res) => {
  const id = parseInt(req.params.id, 10);
  let { date } = req.body;
  if (!date) {
    date = new Date().toISOString().split('T')[0];
  }
  
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }

  try {
    const checkedAt = new Date().toISOString();
    db.prepare('INSERT INTO checkins (habit_id, date, checked_at) VALUES (?, ?, ?)').run(id, date, checkedAt);
    const updatedStreak = calculateStreak(id);
    res.status(201).json({
      id: id,
      habit_id: id,
      date: date,
      checked_at: checkedAt,
      streak: updatedStreak
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: "Already checked in for this date" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// ROUTE D — GET /habits/:id/checkins: Returns an array of checked-in date strings for a habit
app.get('/habits/:id/checkins', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(id);
  if (!habit) {
    return res.status(404).json({ error: "Habit not found" });
  }
  const rows = db.prepare('SELECT date FROM checkins WHERE habit_id = ? ORDER BY date DESC').all(id);
  const dates = rows.map(r => r.date);
  res.status(200).json(dates);
});

// ROUTE E — DELETE /habits/:id/checkin/:date: Removes a specific check-in record for a habit and date
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { date } = req.params;
  db.prepare('DELETE FROM checkins WHERE habit_id = ? AND date = ?').run(id, date);
  res.status(200).json({ message: "Checkin removed" });
});

// ROUTE F — DELETE /habits/:id: Completely removes a habit and all of its corresponding check-in history
app.delete('/habits/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM checkins WHERE habit_id = ?').run(id);
  db.prepare('DELETE FROM habits WHERE id = ?').run(id);
  res.status(200).json({ message: `Habit ${id} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});