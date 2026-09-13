const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'winogradsky_secret_key_2026_safe_and_secure';
const DB_PATH = path.join(__dirname, 'database.sqlite');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
    createTables();
  }
});

function createTables() {
  db.serialize(() => {
    // Create Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        coins INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Transactions table
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Create User Quests (Completed Quests) table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_quests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        quest_id TEXT NOT NULL,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id, quest_id)
      )
    `, () => {
      // Auto-backfill existing completions from historical transactions if any
      db.run(`
        INSERT OR IGNORE INTO user_quests (user_id, quest_id, completed_at)
        SELECT user_id, 'kyiv-vinogradsky', created_at 
        FROM transactions 
        WHERE description LIKE '%Завершення квесту%'
      `);
    });

    // Create News table
    db.run(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        tag_class TEXT NOT NULL,
        image TEXT NOT NULL,
        headline TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Error creating news table:', err.message);
      } else {
        // Seed news table if empty
        db.get('SELECT COUNT(*) AS count FROM news', (countErr, row) => {
          if (!countErr && (!row || row.count === 0)) {
            db.run(`
              INSERT INTO news (tag, tag_class, image, headline, content, date)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              'Літня школа',
              'event-tag',
              'uploads/summer_school.jpg',
              'Winogradskiy International Summer School 3.0 присвячена 170 річчю з дня народження Сергія Виноградського',
              'ІІ Міжнародна міждисциплінарна літня школа, присвячена 170-річчю від дня народження видатного українського вченого, засновника екологічної мікробіології Сергія Виноградського. Програма спрямована на популяризацію природничих наук, розвиток дослідницьких компетентностей молоді та формування міжнародної наукової спільноти майбутніх дослідників.\n\nУчасники школи матимуть можливість долучитися до інтенсивної навчальної програми, що поєднує лекції провідних українських і міжнародних науковців, практичні і лабораторні заняття, майстер-класи, наукові дискусії, командну проєктну роботу, активний відпочинок.',
              '27 серпня 2026'
            ]);
          }
        });
      }
    });
  });
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Доступ заборонено: відсутній токен авторизації' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Недійсний або прострочений токен авторизації' });
    }
    req.user = decoded;
    next();
  });
}

// --- API ENDPOINTS ---

// 1. User Registration
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Будь ласка, заповніть всі обов\'язкові поля (ім\'я, email, пароль)' });
  }

  // Check if email already exists
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка бази даних при перевірці email' });
    }
    if (row) {
      return res.status(400).json({ error: 'Користувач з таким email вже зареєстрований' });
    }

    // Hash password and save user
    bcrypt.hash(password, 10, (hashErr, passwordHash) => {
      if (hashErr) {
        return res.status(500).json({ error: 'Помилка шифрування паролю' });
      }

      db.run(
        'INSERT INTO users (name, email, password, coins) VALUES (?, ?, ?, 0)',
        [name, email, passwordHash],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Помилка бази даних при реєстрації користувача' });
          }

          const userId = this.lastID;
          const token = jwt.sign({ id: userId, email: email }, JWT_SECRET, { expiresIn: '30d' });

          res.status(201).json({
            message: 'Реєстрація успішна',
            token,
            user: {
              id: userId,
              name,
              email,
              coins: 0
            }
          });
        }
      );
    });
  });
});

// 2. User Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Будь ласка, введіть email та пароль' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка бази даних' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Неправильний email або пароль' });
    }

    // Compare passwords
    bcrypt.compare(password, user.password, (bcryptErr, isMatch) => {
      if (bcryptErr) {
        return res.status(500).json({ error: 'Помилка перевірки паролю' });
      }
      if (!isMatch) {
        return res.status(400).json({ error: 'Неправильний email або пароль' });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

      res.json({
        message: 'Вхід успішний',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          coins: user.coins
        }
      });
    });
  });
});

// 3. Get Authenticated User Profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, coins FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка завантаження профілю з бази даних' });
    }
    if (!user) {
      return res.status(404).json({ error: 'Користувача не знайдено' });
    }
    res.json({ user });
  });
});

// 4. Synchronize/Update Coin Balance
app.post('/api/sync_coins', authenticateToken, (req, res) => {
  const { coins } = req.body;

  if (typeof coins !== 'number') {
    return res.status(400).json({ error: 'Помилковий формат монет' });
  }

  db.run('UPDATE users SET coins = ? WHERE id = ?', [coins, req.user.id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка синхронізації монет' });
    }
    res.json({ message: 'Баланс успішно синхронізовано', coins });
  });
});

// 5. Add Transaction Log and update coins
app.post('/api/transactions', authenticateToken, (req, res) => {
  const { description, amount, currentCoins } = req.body;

  if (!description || !amount) {
    return res.status(400).json({ error: 'Неповні дані для транзакції' });
  }

  db.serialize(() => {
    // Start transaction steps
    db.run(
      'INSERT INTO transactions (user_id, description, amount) VALUES (?, ?, ?)',
      [req.user.id, description, amount],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Помилка збереження транзакції' });
        }

        // Also update coins in user table if currentCoins is passed
        if (typeof currentCoins === 'number') {
          db.run('UPDATE users SET coins = ? WHERE id = ?', [currentCoins, req.user.id], (updateErr) => {
            if (updateErr) {
              console.error('Coins update error in transactions post:', updateErr.message);
            }
          });
        }

        res.json({ message: 'Транзакцію успішно записано' });
      }
    );
  });
});

// 6. Get Transaction History
app.get('/api/transactions', authenticateToken, (req, res) => {
  db.all(
    'SELECT description AS desc, amount, created_at AS date FROM transactions WHERE user_id = ? ORDER BY id DESC',
    [req.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Помилка бази даних при читанні транзакцій' });
      }
      res.json({ transactions: rows });
    }
  );
});

// 7. Get News List
app.get('/api/news', (req, res) => {
  db.all('SELECT * FROM news ORDER BY id DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка бази даних при отриманні новин' });
    }
    
    // Dynamically prepend base URL for server-hosted uploads
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;
    
    const newsList = rows.map(row => {
      let imagePath = row.image;
      if (imagePath.startsWith('uploads/')) {
        imagePath = `${baseUrl}/${imagePath}`;
      }
      return {
        id: row.id,
        tag: row.tag,
        tag_class: row.tag_class,
        image: imagePath,
        headline: row.headline,
        content: row.content,
        date: row.date
      };
    });
    
    res.json({ news: newsList });
  });
});

// 8. Record Completed Quest for User
function handleRecordCompletedQuest(req, res) {
  const questId = req.body.questId || req.body.quest_id;
  if (!questId) {
    return res.status(400).json({ error: 'Не вказано ідентифікатор квесту' });
  }

  db.run(
    'INSERT OR IGNORE INTO user_quests (user_id, quest_id) VALUES (?, ?)',
    [req.user.id, questId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Помилка бази даних при збереженні проходження квесту' });
      }
      res.json({
        message: 'Квест успішно зафіксовано як пройдений',
        quest_id: questId,
        user_id: req.user.id
      });
    }
  );
}

app.post('/api/quests/complete', authenticateToken, handleRecordCompletedQuest);
app.post('/api/quest/complete', authenticateToken, handleRecordCompletedQuest);

// 9. Get Completed Quests for User
function handleGetCompletedQuests(req, res) {
  db.all(
    'SELECT quest_id, completed_at FROM user_quests WHERE user_id = ? ORDER BY id ASC',
    [req.user.id],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Помилка отримання списку пройдених квестів' });
      }
      const completedList = (rows || []).map(r => r.quest_id);
      res.json({ completed_quests: completedList, details: rows || [] });
    }
  );
}

app.get('/api/quests/completed', authenticateToken, handleGetCompletedQuests);
app.get('/api/quest/completed', authenticateToken, handleGetCompletedQuests);

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Winogradsky Backend is running on port ${PORT}`);
});
