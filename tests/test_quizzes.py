def test_import_basic(client, sample_quiz):
    resp = client.post('/api/quizzes', json=sample_quiz)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['title'] == 'Sample Quiz'
    assert data['description'] == 'A test quiz'
    assert data['time_limit_seconds'] == 300
    assert data['quiz_set_id'] is None
    assert len(data['questions']) == 2


def test_import_missing_title(client):
    resp = client.post('/api/quizzes', json={'questions': [{'question': 'Q?', 'options': ['A', 'B'], 'correct': 0}]})
    assert resp.status_code == 400
    assert 'Missing' in resp.get_json()['error']


def test_import_missing_questions(client):
    resp = client.post('/api/quizzes', json={'title': 'No Qs'})
    assert resp.status_code == 400


def test_import_empty_body(client):
    resp = client.post('/api/quizzes', json={})
    assert resp.status_code == 400


def test_import_with_set_id(client, sample_quiz):
    set_resp = client.post('/api/sets', json={'name': 'My Set'})
    set_id = set_resp.get_json()['id']

    sample_quiz['set_id'] = set_id
    resp = client.post('/api/quizzes', json=sample_quiz)
    assert resp.status_code == 201
    assert resp.get_json()['quiz_set_id'] == set_id

    set_data = client.get(f'/api/sets/{set_id}').get_json()
    quiz_ids = [q['id'] for q in set_data['quizzes']]
    assert resp.get_json()['id'] in quiz_ids


def test_get_quiz(client, sample_quiz):
    create = client.post('/api/quizzes', json=sample_quiz)
    quiz_id = create.get_json()['id']

    resp = client.get(f'/api/quizzes/{quiz_id}')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['title'] == 'Sample Quiz'
    assert len(data['questions']) == 2


def test_get_quiz_not_found(client):
    resp = client.get('/api/quizzes/999')
    assert resp.status_code == 404


def test_delete_quiz(client, sample_quiz):
    create = client.post('/api/quizzes', json=sample_quiz)
    quiz_id = create.get_json()['id']

    resp = client.delete(f'/api/quizzes/{quiz_id}')
    assert resp.status_code == 200

    resp = client.get(f'/api/quizzes/{quiz_id}')
    assert resp.status_code == 404


def test_list_all(client, sample_quiz):
    client.post('/api/quizzes', json=sample_quiz)
    client.post('/api/quizzes', json={**sample_quiz, 'title': 'Quiz 2'})

    resp = client.get('/api/quizzes')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2


def test_list_ungrouped(client, sample_quiz):
    client.post('/api/quizzes', json=sample_quiz)

    client.post('/api/sets', json={'name': 'S', 'quizzes': [{'title': 'In Set', 'questions': [{'question': 'Q?', 'options': ['A', 'B'], 'correct': 0}]}]})

    resp = client.get('/api/quizzes?set_id=none')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]['title'] == 'Sample Quiz'


def test_list_by_set(client, sample_quiz):
    set_resp = client.post('/api/sets', json={'name': 'S'})
    set_id = set_resp.get_json()['id']

    sample_quiz['set_id'] = set_id
    client.post('/api/quizzes', json=sample_quiz)

    resp = client.get(f'/api/quizzes?set_id={set_id}')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]['title'] == 'Sample Quiz'
