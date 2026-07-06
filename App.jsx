// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

export default function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [loading, setLoading] = useState(true);
  const [newHabitName, setNewHabitName] = useState('');

  const refreshAll = async () => {
    try {
      const habitsRes = await fetch(`${API_URL}/habits`);
      const habitsData = await habitsRes.json();
      
      const checkinsObj = {};
      for (let habit of habitsData) {
        const checkinsRes = await fetch(`${API_URL}/habits/${habit.id}/checkins`);
        const checkinsData = await checkinsRes.json();
        checkinsObj[habit.id] = checkinsData;
      }
      
      setHabits(habitsData);
      setCheckinsByHabit(checkinsObj);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleAddHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHabitName.trim() })
      });
      if (res.ok) {
        setNewHabitName('');
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCheckIn = async (habitId) => {
    try {
      const res = await fetch(`${API_URL}/habits/${habitId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    try {
      const res = await fetch(`${API_URL}/habits/${habitId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await refreshAll();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Generate last 7 days (today and 6 days before)
  const getLast7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      days.push({
        dateStr,
        dayNum: d.getDate()
      });
    }
    return days; // today is index 0, oldest is index 6
  };

  const last7Days = getLast7Days();
  const todayStr = last7Days[0].dateStr;

  return (
    <div className="container">
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit-card">
        <form onSubmit={handleAddHabit} className="new-habit-form">
          <input
            type="text"
            placeholder="e.g. Drink 2L water"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
          />
          <button type="submit">Add Habit</button>
        </form>
      </div>

      <div className="habits-section">
        {loading ? (
          <p>Loading your habits...</p>
        ) : habits.length === 0 ? (
          <p>No habits yet. Add one above to get started!</p>
        ) : (
          habits.map((habit) => {
            const habitCheckins = checkinsByHabit[habit.id] || [];
            const isCheckedInToday = habitCheckins.includes(todayStr);

            return (
              <div key={habit.id} className="habit-card">
                <h3>{habit.name}</h3>
                
                <p className="streak-text">
                  {habit.streak > 0 ? `🔥 ${habit.streak} day streak` : 'No streak yet — check in today!'}
                </p>

                <div className="card-actions">
                  {isCheckedInToday ? (
                    <button className="checkin-btn disabled-done" disabled>
                      ✅ Checked in today
                    </button>
                  ) : (
                    <button className="checkin-btn" onClick={() => handleCheckIn(habit.id)}>
                      Check In
                    </button>
                  )}
                </div>

                <div className="history-row">
                  {last7Days.map((day) => {
                    const isDone = habitCheckins.includes(day.dateStr);
                    return (
                      <div
                        key={day.dateStr}
                        className={`history-box ${isDone ? 'done' : 'not-done'}`}
                        title={day.dateStr}
                      >
                        {day.dayNum}
                      </div>
                    );
                  })}
                </div>

                <button className="delete-btn" onClick={() => handleDeleteHabit(habit.id)}>
                  Delete Habit
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}