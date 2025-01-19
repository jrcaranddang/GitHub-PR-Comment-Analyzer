import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DB {
  constructor() {
    this.dbPath = path.join(__dirname, 'analysis.db');
    this.initPromise = this.init();
  }

  async init() {
    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(data);
      } else {
        this.db = new SQL.Database();
      }
      
      // Create tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS analysis_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_date TEXT,
          end_date TEXT,
          user TEXT,
          label TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS analysis_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER,
          repository TEXT NOT NULL,
          category TEXT NOT NULL,
          count INTEGER NOT NULL,
          FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
        );

        CREATE TABLE IF NOT EXISTS cached_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repository TEXT NOT NULL,
          pr_number INTEGER NOT NULL,
          comment_id TEXT NOT NULL,
          user_login TEXT NOT NULL,
          body TEXT NOT NULL,
          created_at DATETIME NOT NULL,
          category TEXT NOT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(repository, comment_id)
        );

        CREATE INDEX IF NOT EXISTS idx_comments_repo ON cached_comments(repository);
        CREATE INDEX IF NOT EXISTS idx_comments_date ON cached_comments(created_at);
        CREATE INDEX IF NOT EXISTS idx_comments_category ON cached_comments(category);
      `);

      // Save initial database
      this.save();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  async saveAnalysisRun(filters) {
    await this.initPromise;
    
    const stmt = this.db.prepare(`
      INSERT INTO analysis_runs (start_date, end_date, user, label)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run([
      filters.startDate.toISOString(),
      filters.endDate.toISOString(),
      filters.user || null,
      filters.label || null
    ]);
    
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const runId = result[0].values[0][0];
    
    this.save();
    return runId;
  }

  async saveResults(runId, repository, results) {
    await this.initPromise;
    
    const stmt = this.db.prepare(`
      INSERT INTO analysis_results (run_id, repository, category, count)
      VALUES (?, ?, ?, ?)
    `);

    for (const [category, count] of Object.entries(results)) {
      stmt.run([runId, repository, category, count]);
    }
    
    this.save();
  }

  async cacheComment(repository, pr, comment, category) {
    await this.initPromise;
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cached_comments 
      (repository, pr_number, comment_id, user_login, body, created_at, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      repository,
      pr.number,
      comment.id,
      comment.user.login,
      comment.body,
      comment.created_at,
      category
    ]);
    
    this.save();
  }

  async getCachedComments(repository, startDate, endDate, user, label) {
    await this.initPromise;
    
    let query = `
      SELECT * FROM cached_comments 
      WHERE repository = ?
      AND created_at BETWEEN ? AND ?
    `;
    
    const params = [repository, startDate.toISOString(), endDate.toISOString()];
    
    if (user) {
      query += ' AND user_login = ?';
      params.push(user);
    }

    const result = this.db.exec(query, params);
    return result.length > 0 ? result[0].values.map(row => ({
      repository: row[1],
      pr_number: row[2],
      comment_id: row[3],
      user_login: row[4],
      body: row[5],
      created_at: row[6],
      category: row[7]
    })) : [];
  }

  async getAnalysisHistory(limit = 10) {
    await this.initPromise;
    
    const result = this.db.exec(`
      SELECT 
        ar.id,
        ar.start_date,
        ar.end_date,
        ar.user,
        ar.label,
        ar.timestamp,
        GROUP_CONCAT(res.repository) as repositories,
        SUM(res.count) as total_comments
      FROM analysis_runs ar
      LEFT JOIN analysis_results res ON res.run_id = ar.id
      GROUP BY ar.id
      ORDER BY ar.timestamp DESC
      LIMIT ?
    `, [limit]);

    return result.length > 0 ? result[0].values.map(row => ({
      id: row[0],
      start_date: row[1],
      end_date: row[2],
      user: row[3],
      label: row[4],
      timestamp: row[5],
      repositories: row[6],
      total_comments: row[7]
    })) : [];
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

export default new DB();