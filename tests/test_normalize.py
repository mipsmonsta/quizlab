from app import normalize_quiz


def test_minimal():
    data = {
        'title': 'Test',
        'questions': [
            {'question': 'Q?', 'options': ['A', 'B'], 'correct': 0},
        ],
    }
    result = normalize_quiz(data)
    assert result['title'] == 'Test'
    assert len(result['questions']) == 1
    assert result['questions'][0]['question'] == 'Q?'
    assert result['questions'][0]['correct'] == 0
    assert result['description'] == ''
    assert result['source'] == ''
    assert result['time_limit_seconds'] is None
    assert result['set_id'] is None


def test_old_format():
    data = {
        'title': 'Old Format',
        'questions': [
            {
                'question': 'Q1?',
                'options': ['Alpha', 'Beta', 'Gamma'],
                'correct': 2,
            },
        ],
    }
    result = normalize_quiz(data)
    assert result['title'] == 'Old Format'
    assert result['questions'][0]['correct'] == 2


def test_new_format():
    data = {
        'quiz_title': 'New Format',
        'questions': [
            {
                'question_text': 'Q1?',
                'options': ['Alpha', 'Beta', 'Gamma'],
                'correct_answer': 'Gamma',
            },
        ],
    }
    result = normalize_quiz(data)
    assert result['title'] == 'New Format'
    assert result['questions'][0]['question'] == 'Q1?'
    assert result['questions'][0]['correct'] == 2


def test_correct_answer_as_string():
    data = {
        'title': 'String Mapping',
        'questions': [
            {
                'question': 'Q?',
                'options': ['X', 'Y', 'Z'],
                'correct_answer': 'Y',
            },
        ],
    }
    result = normalize_quiz(data)
    assert result['questions'][0]['correct'] == 1


def test_correct_answer_case_insensitive():
    data = {
        'title': 'Case Insensitive',
        'questions': [
            {
                'question': 'Q?',
                'options': ['One', 'Two', 'Three'],
                'correct_answer': 'two',
            },
        ],
    }
    result = normalize_quiz(data)
    assert result['questions'][0]['correct'] == 1


def test_missing_title():
    data = {
        'questions': [
            {'question': 'Q?', 'options': ['A', 'B'], 'correct': 0},
        ],
    }
    result = normalize_quiz(data)
    assert result['title'] == ''


def test_missing_questions():
    data = {'title': 'No Questions'}
    result = normalize_quiz(data)
    assert result['questions'] == []


def test_time_limit_preserved():
    data = {
        'title': 'Timed',
        'time_limit_seconds': 600,
        'questions': [
            {'question': 'Q?', 'options': ['A', 'B'], 'correct': 0},
        ],
    }
    result = normalize_quiz(data)
    assert result['time_limit_seconds'] == 600


def test_set_id_preserved():
    data = {
        'title': 'In Set',
        'set_id': 42,
        'questions': [
            {'question': 'Q?', 'options': ['A', 'B'], 'correct': 0},
        ],
    }
    result = normalize_quiz(data)
    assert result['set_id'] == 42


def test_explanation_preserved():
    data = {
        'title': 'Explained',
        'questions': [
            {
                'question': 'Q?',
                'options': ['A', 'B'],
                'correct': 0,
                'explanation': 'Because reasons',
            },
        ],
    }
    result = normalize_quiz(data)
    assert result['questions'][0]['explanation'] == 'Because reasons'
