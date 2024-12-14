import express, { Request, Response } from 'express';
import mysql from 'mysql2';
import cors from 'cors';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL-Verbindung konfigurieren
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'IhrPasswort',
  database: 'IhreDatenbank',
});

// Verbindung herstellen
db.connect((err) => {
  if (err) {
    console.error('Datenbankverbindung fehlgeschlagen:', err);
  } else {
    console.log('Mit der Datenbank verbunden.');
  }
});

// Login-Endpunkt
app.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Serverfehler' });
    } else if (Array.isArray(results) && results.length > 0) {
      res.json({ success: true, message: 'Login erfolgreich' });
    } else {
      res.json({ success: false, message: 'Ungültige Anmeldedaten' });
    }
  });
});

// Server starten
app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});