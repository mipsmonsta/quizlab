# QuizLab

Import quizzes from NotebookLM JSON and take them in a single-page webapp with SQLite storage.

## Quick start

```bash
pip install flask
python app.py
```

Open http://localhost:8080 in your browser.

## Import formats

**Single quiz:**
```json
{
  "quiz_title": "Topic Quiz",
  "questions": [
    {
      "question_number": 1,
      "question_text": "Question?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "..."
    }
  ]
}
```

**Quiz set (multiple quizzes at once):**
```json
{
  "set_name": "Week 1 Review",
  "set_date": "2026-07-16",
  "quizzes": [
    { "title": "Quiz 1", "questions": [...] },
    { "title": "Quiz 2", "questions": [...] }
  ]
}
```

Legacy formats (`title`/`question`/`correct` as index) are also accepted.

## Features

- **Quiz sets** — Organise quizzes into named sets with dates. Home screen shows sets; drill in to see individual quizzes.
- **Take quizzes** — One question at a time with prev/next navigation. Progress dots show answered vs unanswered questions.
- **Timer** — Optional per-quiz countdown. Auto-submits when time runs out. Turns red below 60 seconds.
- **Progress persistence** — Answers auto-save (debounced) as you go. Close the tab and resume later from the same spot.
- **Results** — Score (X/Y), percentage, pass/fail indicator, per-question breakdown with correct/incorrect highlighting and explanations.
- **Re-take** — Completed quizzes can be taken again. Old results are preserved.
- **Review** — See all questions with correct answers marked, your answers highlighted, and explanations.
- **Dark/light theme** — Toggle in the nav bar. Preference saved in localStorage.
- **Import preview** — Paste JSON or upload a file. Preview shows the parsed quiz before saving.
- **Import into set** — Click "+ Add quiz" on a set detail page to go to the import page with that set pre-selected in the dropdown.
- **Ungrouped quizzes** — Quizzes without a set appear at the bottom of the home page.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/quizzes` | List quizzes (add `?set_id=none` for ungrouped, `?set_id=1` for a set) |
| `POST` | `/api/quizzes` | Import a single quiz |
| `GET` | `/api/quizzes/{id}` | Get quiz without correct answers (for taking) |
| `GET` | `/api/quizzes/{id}/review` | Get quiz with correct answers |
| `DELETE` | `/api/quizzes/{id}` | Delete a quiz |
| `GET` | `/api/sets` | List quiz sets |
| `POST` | `/api/sets` | Create a set (optionally with quizzes) |
| `GET` | `/api/sets/{id}` | Get a set with its quizzes |
| `DELETE` | `/api/sets/{id}` | Delete a set (quizzes become ungrouped) |
| `POST` | `/api/quizzes/{id}/start` | Start a new attempt |
| `POST` | `/api/quizzes/{id}/save` | Save mid-quiz progress |
| `POST` | `/api/quizzes/{id}/submit` | Submit answers, get score |
| `GET` | `/api/attempts/latest/{quizId}` | Get the latest attempt (for resuming) |

## Project structure

```
quizlab/
├── app.py              # Flask server (API + static files)
├── db.py               # SQLite schema and connection
├── requirements.txt    # flask
├── quizzes.db          # Created automatically on first run
└── frontend/
    ├── index.html       # SPA shell (Tailwind CDN)
    ├── style.css        # Custom styles (timer, options, progress dots)
    └── js/
        ├── api.js       # Fetch wrapper for all API endpoints
        ├── views.js     # Render functions for each view
        └── app.js       # Router, theme toggle, global state
```

## Dependencies

- Python 3.12+
- Flask (installed via `pip`)
- Everything else is standard library (sqlite3, json)

Frontend: Tailwind CSS v3 via CDN. No build step.
