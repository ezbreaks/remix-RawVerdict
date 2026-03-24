import Database from 'better-sqlite3';

const db = new Database('cards.db');

try {
  const users = db.prepare('SELECT id, username, email, role, created_at, last_login_at FROM users').all();
  console.log('--- Registered Users ---');
  console.table(users);
} catch (error) {
  console.error('Error reading users:', error);
} finally {
  db.close();
}
