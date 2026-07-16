import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'quizzes.db')


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            time_limit_seconds INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            question_type TEXT NOT NULL DEFAULT 'multiple_choice',
            options_json TEXT NOT NULL DEFAULT '[]',
            correct_index INTEGER NOT NULL DEFAULT 0,
            explanation TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'in_progress'
                CHECK(status IN ('in_progress', 'completed')),
            current_question INTEGER NOT NULL DEFAULT 0,
            answers_json TEXT NOT NULL DEFAULT '{}',
            score INTEGER,
            total INTEGER NOT NULL DEFAULT 0,
            time_taken_seconds INTEGER,
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_attempts_quiz_status
            ON quiz_attempts(quiz_id, status);

        CREATE TABLE IF NOT EXISTS quiz_sets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()

    # Add quiz_set_id column to quizzes if missing
    cursor = conn.execute("PRAGMA table_info(quizzes)")
    cols = [row[1] for row in cursor.fetchall()]
    if 'quiz_set_id' not in cols:
        conn.execute("ALTER TABLE quizzes ADD COLUMN quiz_set_id INTEGER REFERENCES quiz_sets(id) ON DELETE SET NULL")

    conn.commit()
    conn.close()
