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
        CREATE TABLE IF NOT EXISTS terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_set_id INTEGER NOT NULL REFERENCES quiz_sets(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(quiz_set_id, name)
        );

        CREATE TABLE IF NOT EXISTS question_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
            field TEXT NOT NULL,
            start_pos INTEGER NOT NULL,
            end_pos INTEGER NOT NULL,
            UNIQUE(question_id, term_id, field, start_pos)
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


# ── Terms helpers ────────────────────────────────────────────────────


def get_term(term_id):
    conn = get_conn()
    row = conn.execute('SELECT * FROM terms WHERE id = ?', (term_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_terms_for_set(set_id):
    conn = get_conn()
    rows = conn.execute(
        'SELECT * FROM terms WHERE quiz_set_id = ? ORDER BY name', (set_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_quiz_set_id_for_question(question_id):
    conn = get_conn()
    row = conn.execute(
        """SELECT qu.quiz_set_id FROM questions qs
           JOIN quizzes qu ON qu.id = qs.quiz_id
           WHERE qs.id = ?""",
        (question_id,),
    ).fetchone()
    conn.close()
    return row['quiz_set_id'] if row else None


def get_term_links_for_question(question_id):
    conn = get_conn()
    rows = conn.execute(
        """SELECT qt.id, qt.term_id, qt.field, qt.start_pos, qt.end_pos, t.name AS term_name, t.note
           FROM question_terms qt JOIN terms t ON t.id = qt.term_id
           WHERE qt.question_id = ? ORDER BY qt.field, qt.start_pos""",
        (question_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_term(set_id, name, note=''):
    existing = get_term_by_name(set_id, name)
    if existing:
        return existing
    conn = get_conn()
    cur = conn.execute(
        'INSERT INTO terms (quiz_set_id, name, note) VALUES (?, ?, ?)',
        (set_id, name, note),
    )
    conn.commit()
    row = conn.execute('SELECT * FROM terms WHERE id = ?', (cur.lastrowid,)).fetchone()
    conn.close()
    return dict(row)


def get_term_by_name(set_id, name):
    conn = get_conn()
    row = conn.execute(
        'SELECT * FROM terms WHERE quiz_set_id = ? AND name = ?', (set_id, name)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def update_term_note(term_id, note):
    conn = get_conn()
    conn.execute(
        "UPDATE terms SET note = ?, updated_at = datetime('now') WHERE id = ?",
        (note, term_id),
    )
    conn.commit()
    row = conn.execute('SELECT * FROM terms WHERE id = ?', (term_id,)).fetchone()
    conn.close()
    return dict(row)


def delete_term(term_id):
    conn = get_conn()
    conn.execute('DELETE FROM question_terms WHERE term_id = ?', (term_id,))
    conn.execute('DELETE FROM terms WHERE id = ?', (term_id,))
    conn.commit()
    conn.close()


def link_term_to_question(question_id, term_id, field, start_pos, end_pos):
    conn = get_conn()
    cur = conn.execute(
        'INSERT INTO question_terms (question_id, term_id, field, start_pos, end_pos) VALUES (?, ?, ?, ?, ?)',
        (question_id, term_id, field, start_pos, end_pos),
    )
    conn.commit()
    link_id = cur.lastrowid
    conn.close()
    return link_id


def unlink_term_from_question(link_id):
    conn = get_conn()
    conn.execute('DELETE FROM question_terms WHERE id = ?', (link_id,))
    conn.commit()
    conn.close()
