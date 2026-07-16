import json
import os
from flask import Flask, request, jsonify, send_from_directory, abort

from db import get_conn, init_db

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')

app = Flask(__name__)

init_db()


def get_db():
    return get_conn()


def question_to_dict(q, include_answers=False):
    result = {
        'id': q['id'],
        'question': q['question_text'],
        'type': q['question_type'],
        'options': json.loads(q['options_json']) if q['options_json'] else [],
    }
    if include_answers:
        result['correct'] = q['correct_index']
        result['explanation'] = q['explanation']
    return result


def get_questions(quiz_id, include_answers=False):
    db = get_db()
    rows = db.execute(
        'SELECT * FROM questions WHERE quiz_id = ? ORDER BY id', (quiz_id,)
    ).fetchall()
    return [question_to_dict(r, include_answers) for r in rows]


def answer_map(raw):
    m = {}
    for k, v in (raw or {}).items():
        m[int(k)] = v
    return m


def normalize_quiz(data):
    """Accept both old (title, question, correct) and new
    (quiz_title, question_text, correct_answer) formats."""
    result = {
        'title': data.get('title') or data.get('quiz_title', ''),
        'description': data.get('description', ''),
        'source': data.get('source', ''),
        'time_limit_seconds': data.get('time_limit_seconds'),
        'set_id': data.get('set_id'),
        'questions': [],
    }

    for q in data.get('questions', []):
        question_text = q.get('question') or q.get('question_text', '')
        options = q.get('options', [])

        correct = q.get('correct')
        if correct is None or isinstance(correct, str):
            correct_answer = q.get('correct_answer') or correct
            if correct_answer and correct_answer in options:
                correct = options.index(correct_answer)
            elif correct_answer:
                lower_opts = [o.lower() for o in options]
                lower_key = correct_answer.lower()
                correct = lower_opts.index(lower_key) if lower_key in lower_opts else 0
            else:
                correct = 0
        correct = int(correct) if correct is not None else 0

        result['questions'].append({
            'question': question_text,
            'type': q.get('type', 'multiple_choice'),
            'options': options,
            'correct': correct,
            'explanation': q.get('explanation', ''),
        })

    return result


# ── Frontend serving ──────────────────────────────────────────────


@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/js/<path:filename>')
def js_files(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'js'), filename)


@app.route('/style.css')
def style():
    return send_from_directory(FRONTEND_DIR, 'style.css')


@app.route('/<path:path>')
def fallback(path):
    if path.startswith('api/'):
        abort(404)
    fp = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(fp):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, 'index.html')


# ── API: Quizzes ──────────────────────────────────────────────────


@app.route('/api/quizzes', methods=['GET'])
def list_quizzes():
    set_id = request.args.get('set_id')
    db = get_db()

    if set_id == 'none':
        rows = db.execute("""
            SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
            FROM quizzes q WHERE q.quiz_set_id IS NULL ORDER BY q.created_at DESC
        """).fetchall()
    elif set_id:
        rows = db.execute("""
            SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
            FROM quizzes q WHERE q.quiz_set_id = ? ORDER BY q.created_at DESC
        """, (int(set_id),)).fetchall()
    else:
        rows = db.execute("""
            SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
            FROM quizzes q ORDER BY q.created_at DESC
        """).fetchall()

    quizzes = []
    for r in rows:
        q = dict(r)
        at = db.execute(
            'SELECT id, status, score, total FROM quiz_attempts WHERE quiz_id = ? ORDER BY id DESC LIMIT 1',
            (q['id'],),
        ).fetchone()
        q['latest_attempt'] = dict(at) if at else None
        quizzes.append(q)
    return jsonify(quizzes)


@app.route('/api/quizzes', methods=['POST'])
def import_quiz():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'Missing request body'}), 400

    quiz = normalize_quiz(data)
    if not quiz['title'] or not quiz['questions']:
        return jsonify({'error': 'Missing required fields: title/quiz_title, questions'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO quizzes (title, description, source, time_limit_seconds, quiz_set_id) VALUES (?, ?, ?, ?, ?)',
        (quiz['title'], quiz['description'], quiz['source'],
         quiz['time_limit_seconds'], quiz['set_id']),
    )
    quiz_id = cur.lastrowid

    for q in quiz['questions']:
        db.execute(
            'INSERT INTO questions (quiz_id, question_text, question_type, options_json, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?)',
            (quiz_id, q['question'], q['type'],
             json.dumps(q['options']), q['correct'], q['explanation']),
        )

    db.commit()

    result = dict(db.execute('SELECT * FROM quizzes WHERE id = ?', (quiz_id,)).fetchone())
    result['questions'] = get_questions(quiz_id, include_answers=True)
    return jsonify(result), 201


@app.route('/api/quizzes/<int:quiz_id>', methods=['GET'])
def get_quiz(quiz_id):
    db = get_db()
    quiz = db.execute('SELECT * FROM quizzes WHERE id = ?', (quiz_id,)).fetchone()
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404
    q = dict(quiz)
    q['questions'] = get_questions(quiz_id, include_answers=True)
    return jsonify(q)


@app.route('/api/quizzes/<int:quiz_id>/review', methods=['GET'])
def review_quiz(quiz_id):
    db = get_db()
    quiz = db.execute('SELECT * FROM quizzes WHERE id = ?', (quiz_id,)).fetchone()
    if not quiz:
        return jsonify({'error': 'Quiz not found'}), 404
    q = dict(quiz)
    q['questions'] = get_questions(quiz_id, include_answers=True)
    return jsonify(q)


@app.route('/api/quizzes/<int:quiz_id>', methods=['DELETE'])
def delete_quiz(quiz_id):
    db = get_db()
    db.execute('DELETE FROM quizzes WHERE id = ?', (quiz_id,))
    db.commit()
    return jsonify({'ok': True})


# ── API: Sets ─────────────────────────────────────────────────────

@app.route('/api/sets', methods=['GET'])
def list_sets():
    db = get_db()
    rows = db.execute("""
        SELECT s.*,
               (SELECT COUNT(*) FROM quizzes WHERE quiz_set_id = s.id) AS quiz_count
        FROM quiz_sets s ORDER BY s.created_at DESC
    """).fetchall()
    sets = []
    for r in rows:
        s = dict(r)
        quizzes = db.execute(
            'SELECT id FROM quizzes WHERE quiz_set_id = ?', (s['id'],)
        ).fetchall()
        total = len(quizzes)
        completed = 0
        in_progress = 0
        for q in quizzes:
            at = db.execute(
                "SELECT status FROM quiz_attempts WHERE quiz_id = ? ORDER BY id DESC LIMIT 1",
                (q['id'],)
            ).fetchone()
            if at:
                if at['status'] == 'completed':
                    completed += 1
                elif at['status'] == 'in_progress':
                    in_progress += 1
        s['completed'] = completed
        s['in_progress'] = in_progress
        s['total'] = total
        sets.append(s)
    return jsonify(sets)


@app.route('/api/sets', methods=['POST'])
def create_set():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'Missing request body'}), 400
    name = data.get('name') or data.get('set_name')
    if not name:
        return jsonify({'error': 'Missing required field: name or set_name'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO quiz_sets (name, date) VALUES (?, ?)',
        (name, data.get('date') or data.get('set_date')),
    )
    set_id = cur.lastrowid

    if 'quizzes' in data and isinstance(data['quizzes'], list):
        for quiz_data in data['quizzes']:
            nq = normalize_quiz(quiz_data)
            if not nq['title'] or not nq['questions']:
                continue
            cur2 = db.execute(
                'INSERT INTO quizzes (title, description, source, time_limit_seconds, quiz_set_id) VALUES (?, ?, ?, ?, ?)',
                (nq['title'], nq['description'], nq['source'],
                 nq['time_limit_seconds'], set_id),
            )
            qid = cur2.lastrowid
            for q in nq['questions']:
                db.execute(
                    'INSERT INTO questions (quiz_id, question_text, question_type, options_json, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?)',
                    (qid, q['question'], q['type'],
                     json.dumps(q['options']), q['correct'], q['explanation']),
                )

    db.commit()
    result = dict(db.execute('SELECT * FROM quiz_sets WHERE id = ?', (set_id,)).fetchone())
    return jsonify(result), 201


@app.route('/api/sets/<int:set_id>', methods=['GET'])
def get_set(set_id):
    db = get_db()
    row = db.execute('SELECT * FROM quiz_sets WHERE id = ?', (set_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Set not found'}), 404

    result = dict(row)
    quizzes = []
    rows = db.execute("""
        SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
        FROM quizzes q WHERE q.quiz_set_id = ? ORDER BY q.created_at DESC
    """, (set_id,)).fetchall()
    for r in rows:
        q = dict(r)
        at = db.execute(
            'SELECT id, status, score, total FROM quiz_attempts WHERE quiz_id = ? ORDER BY id DESC LIMIT 1',
            (q['id'],),
        ).fetchone()
        q['latest_attempt'] = dict(at) if at else None
        quizzes.append(q)

    result['quizzes'] = quizzes
    return jsonify(result)


@app.route('/api/sets/<int:set_id>', methods=['DELETE'])
def delete_set(set_id):
    db = get_db()
    # Unlink quizzes from the set, then delete the set
    db.execute('UPDATE quizzes SET quiz_set_id = NULL WHERE quiz_set_id = ?', (set_id,))
    db.execute('DELETE FROM quiz_sets WHERE id = ?', (set_id,))
    db.commit()
    return jsonify({'ok': True})


# ── API: Attempts ─────────────────────────────────────────────────


@app.route('/api/quizzes/<int:quiz_id>/start', methods=['POST'])
def start_attempt(quiz_id):
    db = get_db()
    total = db.execute(
        'SELECT COUNT(*) AS c FROM questions WHERE quiz_id = ?', (quiz_id,)
    ).fetchone()['c']
    if total == 0:
        return jsonify({'error': 'Quiz has no questions'}), 400

    cur = db.execute(
        'INSERT INTO quiz_attempts (quiz_id, status, current_question, total, answers_json) VALUES (?, ?, ?, ?, ?)',
        (quiz_id, 'in_progress', 0, total, '{}'),
    )
    db.commit()

    a = dict(db.execute('SELECT * FROM quiz_attempts WHERE id = ?', (cur.lastrowid,)).fetchone())
    a['answers'] = {}
    return jsonify(a), 201


@app.route('/api/quizzes/<int:quiz_id>/save', methods=['POST'])
def save_progress(quiz_id):
    data = request.get_json(force=True)
    if data is None:
        return jsonify({'error': 'Missing request body'}), 400

    db = get_db()
    attempt = db.execute(
        'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
        (quiz_id, 'in_progress'),
    ).fetchone()
    if not attempt:
        return jsonify({'error': 'No active attempt found'}), 404

    db.execute(
        'UPDATE quiz_attempts SET answers_json = ?, current_question = ? WHERE id = ?',
        (json.dumps(data.get('answers', {})), data.get('current_question', 0), attempt['id']),
    )
    db.commit()
    return jsonify({'ok': True})


@app.route('/api/quizzes/<int:quiz_id>/submit', methods=['POST'])
def submit_attempt(quiz_id):
    data = request.get_json(force=True)
    if data is None:
        return jsonify({'error': 'Missing request body'}), 400

    db = get_db()
    attempt = db.execute(
        'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
        (quiz_id, 'in_progress'),
    ).fetchone()
    if not attempt:
        return jsonify({'error': 'No active attempt found'}), 404

    raw_answers = data.get('answers', {})
    answers = answer_map(raw_answers)
    questions = get_questions(quiz_id, include_answers=True)

    correct_count = 0
    results = []
    for q in questions:
        selected = answers.get(q['id'])
        is_correct = (selected == q['correct'])
        if is_correct:
            correct_count += 1
        results.append({'question': q, 'selected': selected, 'correct': is_correct})

    total = attempt['total']
    time_taken = data.get('time_taken_seconds', 0)

    db.execute(
        """UPDATE quiz_attempts
           SET status = ?, answers_json = ?, score = ?, time_taken_seconds = ?,
               completed_at = datetime('now')
           WHERE id = ?""",
        ('completed', json.dumps(answers), correct_count, time_taken, attempt['id']),
    )
    db.commit()

    updated = dict(db.execute('SELECT * FROM quiz_attempts WHERE id = ?', (attempt['id'],)).fetchone())
    updated.pop('answers_json', None)
    return jsonify({'attempt': updated, 'results': results, 'score': correct_count, 'total': total})


@app.route('/api/attempts/latest/<int:quiz_id>', methods=['GET'])
def get_latest_attempt(quiz_id):
    db = get_db()
    attempt = db.execute(
        'SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY id DESC LIMIT 1',
        (quiz_id,),
    ).fetchone()
    if not attempt:
        return jsonify({'error': 'No attempts found'}), 404

    a = dict(attempt)
    a['answers'] = json.loads(a.pop('answers_json')) if a.get('answers_json') else {}
    return jsonify(a)


# ── Entry point ───────────────────────────────────────────────────

if __name__ == '__main__':
    print("QuizLab running at http://localhost:8080")
    app.run(host='0.0.0.0', port=8080, debug=True)
