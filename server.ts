import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'rawverdict-secret-key-2024';

// Email Transporter Configuration
let transporter: nodemailer.Transporter | null = null;

async function initEmail() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP Verification Error:', error);
        transporter = null; // Fallback to null if verification fails
      } else {
        console.log('SMTP Server is ready to take our messages');
      }
    });
  } else {
    try {
      console.log('No SMTP credentials found. Attempting to create Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('✅ Ethereal Email test account created. Emails will be available via preview URLs.');
    } catch (err) {
      console.warn('⚠️ Failed to create Ethereal test account. Emails will only be logged to console.', err);
    }
  }
}

// Initialize Database
let db: Database.Database;

function initDB() {
  db = new Database('cards.db');
  db.pragma('journal_mode = WAL');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      reset_token TEXT,
      reset_token_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME
    )
  `);

  // Create cards table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      year TEXT,
      set_name TEXT,
      card_number TEXT,
      player_name TEXT,
      team_name TEXT,
      variant TEXT,
      serial_number TEXT,
      quantity INTEGER DEFAULT 1,
      market_price TEXT,
      market_updated_at DATETIME,
      front_image TEXT,
      back_image TEXT,
      notes TEXT,
      graded_by TEXT,
      grade TEXT,
      cert_number TEXT,
      analysis TEXT,
      slab_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Migrations
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT UNIQUE'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN user_id INTEGER'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN team_name TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN market_price TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN market_updated_at DATETIME'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN graded_by TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN grade TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN cert_number TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN analysis TEXT'); } catch (e) {}
  try { db.exec('ALTER TABLE cards ADD COLUMN slab_image TEXT'); } catch (e) {}

  // Seed Admin User
  const adminUsername = 'admin';
  const adminPassword = 'password123';
  const adminEmail = 'rawverdictsupport@gmail.com';
  
  const existingAdmin = db.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)').run(adminUsername, adminEmail, hashedPassword, 'admin');
    console.log('Admin user seeded: admin');
  } else {
    db.prepare('UPDATE users SET email = ? WHERE username = ?').run(adminEmail, adminUsername);
    console.log('Admin email updated to rawverdictsupport@gmail.com');
  }
}

initDB();

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

async function startServer() {
  await initEmail();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      if (!username || !password || !email) throw new Error('Username, email and password required');

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Check if this is the first user
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
      const role = userCount.count === 0 ? 'admin' : 'user';

      const stmt = db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, role);
      
      const token = jwt.sign({ id: info.lastInsertRowid, username, role, email }, JWT_SECRET);
      res.json({ token, user: { id: info.lastInsertRowid, username, role, email } });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
      
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, email: user.email }, JWT_SECRET);
      
      // Update last login
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), user.id);

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const { username, password } = req.body;
      const userId = req.user.id;

      if (username) {
        // Check if username is taken
        const existing = db.prepare('SELECT * FROM users WHERE username = ? AND id != ?').get(username, userId);
        if (existing) return res.status(400).json({ error: 'Username already taken' });
        
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
      }

      const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(userId) as any;
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role, email: user.email }, JWT_SECRET);
      
      res.json({ token, user });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/reset-request', async (req, res) => {
    try {
      const { email } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
      
      if (user) {
        const resetToken = Math.random().toString(36).substring(2, 15);
        const expiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour
        db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?').run(resetToken, expiry, user.id);
        
        console.log(`Password reset requested for ${email}. Token: ${resetToken}`);

        // Construct reset link
        const baseUrl = process.env.APP_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
        // Ensure baseUrl doesn't have a trailing slash for consistency
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const resetLink = `${normalizedBaseUrl}/?token=${resetToken}`;

        // Send email
        if (transporter) {
          console.log(`Attempting to send reset email to ${email}...`);
          try {
            const info = await transporter.sendMail({
              from: process.env.SMTP_FROM || `"RawVerdict Support" <rawverdictsupport@gmail.com>`,
              to: email,
              subject: 'Password Reset Request',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h2 style="color: #4f46e5;">Reset Your Password</h2>
                  <p>You requested a password reset for your RawVerdict account.</p>
                  <p>Click the button below to set a new password:</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
                  </div>
                  <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour.</p>
                  <p style="color: #64748b; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 12px; text-align: center;">RawVerdict Card Collection Manager</p>
                </div>
              `
            });
            
            console.log(`✅ Reset email successfully sent to ${email}`);
            
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
              console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
              return res.json({ 
                message: "Test email sent! Click the link below to view it.",
                previewUrl: previewUrl
              });
            }

            return res.json({ message: "If an account exists with that email, a reset link has been sent." });
          } catch (emailError) {
            console.error('❌ Failed to send email:', emailError);
            // Return link for dev/testing if email fails
            return res.json({ 
              message: "Failed to send email (check server logs). For testing purposes, here is the link:",
              debugLink: resetLink 
            });
          }
        } else {
            console.log('⚠️ No email transporter available. Skipping real email send.');
            console.log(`🔗 Reset Link for ${email}: ${resetLink}`);
            // Return link for dev/testing if no SMTP config
            return res.json({ 
              message: "Email service not configured. For testing purposes, here is the link:",
              debugLink: resetLink 
            });
        }
      }

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;
      const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?').get(token, new Date().toISOString()) as any;
      
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?').run(hashedPassword, user.id);
      
      res.json({ message: "Password reset successful" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/auth/me', authenticateToken, (req: any, res) => {
    try {
      const user = db.prepare('SELECT id, username, email, role, last_login_at FROM users WHERE id = ?').get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/auth/toggle-admin', authenticateToken, (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
      
      const updatedUser = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(userId) as any;
      const token = jwt.sign({ id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, email: updatedUser.email }, JWT_SECRET);
      
      res.json({ token, user: updatedUser });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Admin Routes
  app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
    try {
      console.log('GET /api/admin/users called by', (req as any).user.username);
      const users = db.prepare('SELECT id, username, email, role, created_at, last_login_at FROM users').all();
      res.json(users);
    } catch (error) {
      console.error('GET /api/admin/users error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
    try {
      console.log(`DELETE /api/admin/users/${req.params.id} called by`, (req as any).user.username);
      // Don't allow deleting yourself
      if (Number(req.params.id) === (req as any).user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM cards WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
      });
      transaction();
      res.json({ success: true });
    } catch (error) {
      console.error(`DELETE /api/admin/users/${req.params.id} error:`, error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/admin/users/:id/role', authenticateToken, isAdmin, (req, res) => {
    try {
      console.log(`PATCH /api/admin/users/${req.params.id}/role called by`, (req as any).user.username, 'Body:', req.body);
      const { role } = req.body;
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(`PATCH /api/admin/users/${req.params.id}/role error:`, error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/admin/users/:id/password', authenticateToken, isAdmin, async (req, res) => {
    try {
      console.log(`PATCH /api/admin/users/${req.params.id}/password called by`, (req as any).user.username);
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Password is required' });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(`PATCH /api/admin/users/${req.params.id}/password error:`, error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/admin/users/:id', authenticateToken, isAdmin, (req, res) => {
    try {
      const { username, email } = req.body;
      const userId = req.params.id;

      if (username) {
        const existing = db.prepare('SELECT * FROM users WHERE username = ? AND id != ?').get(username, userId);
        if (existing) return res.status(400).json({ error: 'Username already taken' });
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
      }

      if (email) {
        const existing = db.prepare('SELECT * FROM users WHERE email = ? AND id != ?').get(email, userId);
        if (existing) return res.status(400).json({ error: 'Email already taken' });
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
    try {
      console.log('POST /api/admin/users called by', (req as any).user.username, 'Body:', req.body);
      const { username, email, password, role } = req.body;
      if (!username || !password || !email) throw new Error('Username, email and password required');

      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)');
      const info = stmt.run(username, email, hashedPassword, role || 'user');
      
      res.json({ id: info.lastInsertRowid, username, email, role: role || 'user' });
    } catch (error) {
      console.error('POST /api/admin/users error:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Card Routes (Protected by user_id)
  app.get('/api/cards', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC');
      const cards = stmt.all(req.user.id) as any[];
      
      // Parse analysis JSON if it exists
      const parsedCards = cards.map(card => ({
        ...card,
        analysis: card.analysis ? JSON.parse(card.analysis) : undefined
      }));
      
      res.json(parsedCards);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/cards', authenticateToken, (req: any, res) => {
    try {
      const { year, set_name, card_number, player_name, team_name, variant, serial_number, quantity, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysis } = req.body;
      const analysisStr = analysis ? JSON.stringify(analysis) : null;
      
      const stmt = db.prepare(`
        INSERT INTO cards (user_id, year, set_name, card_number, player_name, team_name, variant, serial_number, quantity, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(req.user.id, year, set_name, card_number, player_name, team_name, variant, serial_number, quantity || 1, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysisStr);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put('/api/cards/:id', authenticateToken, (req: any, res) => {
    try {
      const { year, set_name, card_number, player_name, team_name, variant, serial_number, quantity, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysis } = req.body;
      const analysisStr = analysis ? JSON.stringify(analysis) : null;
      
      const stmt = db.prepare(`
        UPDATE cards 
        SET year = ?, set_name = ?, card_number = ?, player_name = ?, team_name = ?, variant = ?, serial_number = ?, quantity = ?, market_price = ?, front_image = ?, back_image = ?, slab_image = ?, notes = ?, graded_by = ?, grade = ?, cert_number = ?, analysis = ?
        WHERE id = ? AND user_id = ?
      `);
      const info = stmt.run(year, set_name, card_number, player_name, team_name, variant, serial_number, quantity, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysisStr, req.params.id, req.user.id);
      if (info.changes === 0) return res.status(404).json({ error: 'Card not found or unauthorized' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch('/api/cards/:id/market', authenticateToken, (req: any, res) => {
    try {
      const { market_price } = req.body;
      const stmt = db.prepare(`
        UPDATE cards 
        SET market_price = ?, market_updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `);
      const info = stmt.run(market_price, req.params.id, req.user.id);
      if (info.changes === 0) return res.status(404).json({ error: 'Card not found or unauthorized' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete('/api/cards/:id', authenticateToken, (req: any, res) => {
    try {
      const stmt = db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?');
      const info = stmt.run(req.params.id, req.user.id);
      if (info.changes === 0) return res.status(404).json({ error: 'Card not found or unauthorized' });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/deduplicate', authenticateToken, (req: any, res) => {
    try {
      const cards = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(req.user.id) as any[];
      const seen = new Map();
      const toDelete: number[] = [];
      const toUpdate: { id: number, quantity: number }[] = [];

      cards.forEach(card => {
        const key = `${card.year}|${card.set_name}|${card.card_number}|${card.player_name}|${card.variant}|${card.serial_number}`;
        if (seen.has(key)) {
          const originalId = seen.get(key);
          const originalCard = cards.find(c => c.id === originalId);
          if (originalCard) {
             toDelete.push(card.id);
             let updateOp = toUpdate.find(op => op.id === originalId);
             if (!updateOp) {
               updateOp = { id: originalId, quantity: originalCard.quantity };
               toUpdate.push(updateOp);
             }
             updateOp.quantity += card.quantity;
          }
        } else {
          seen.set(key, card.id);
        }
      });

      const deleteStmt = db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?');
      const updateStmt = db.prepare('UPDATE cards SET quantity = ? WHERE id = ? AND user_id = ?');

      const transaction = db.transaction(() => {
        for (const id of toDelete) {
          deleteStmt.run(id, req.user.id);
        }
        for (const op of toUpdate) {
          updateStmt.run(op.quantity, op.id, req.user.id);
        }
      });

      transaction();
      res.json({ deleted: toDelete.length, updated: toUpdate.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/backup/db', authenticateToken, (req: any, res) => {
    try {
      // For multi-user, we might want to export only their cards as a new DB or JSON
      // But the user asked for "their database is saved to their device locally".
      // Exporting the whole cards.db is bad for privacy.
      // I'll export a JSON of their cards which they can re-import.
      const cards = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(req.user.id);
      res.setHeader('Content-Disposition', `attachment; filename=rawverdict_backup_${req.user.username}.json`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(cards, null, 2));
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
  
  app.post('/api/restore/db', authenticateToken, (req: any, res) => {
      try {
          const { cards } = req.body;
          if (!Array.isArray(cards)) throw new Error("Invalid data format");
          
          const insertStmt = db.prepare(`
            INSERT INTO cards (user_id, year, set_name, card_number, player_name, team_name, variant, serial_number, quantity, market_price, front_image, back_image, slab_image, notes, graded_by, grade, cert_number, analysis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const transaction = db.transaction(() => {
            for (const card of cards) {
              const analysisStr = card.analysis ? JSON.stringify(card.analysis) : null;
              insertStmt.run(
                req.user.id, card.year, card.set_name, card.card_number, card.player_name, 
                card.team_name, card.variant, card.serial_number, card.quantity || 1, 
                card.market_price, card.front_image, card.back_image, card.slab_image, card.notes, 
                card.graded_by, card.grade, card.cert_number, analysisStr
              );
            }
          });
          
          transaction();
          res.json({ success: true, message: `${cards.length} cards restored successfully.` });
      } catch (error) {
          res.status(500).json({ error: (error as Error).message });
      }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
