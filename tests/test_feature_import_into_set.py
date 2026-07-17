def test_import_quiz_into_set_and_verify(client, sample_quiz):
    set_resp = client.post('/api/sets', json={'name': 'Target Set'})
    set_id = set_resp.get_json()['id']

    sample_quiz['set_id'] = set_id
    quiz_resp = client.post('/api/quizzes', json=sample_quiz)
    assert quiz_resp.status_code == 201
    quiz_id = quiz_resp.get_json()['id']
    assert quiz_resp.get_json()['quiz_set_id'] == set_id

    set_data = client.get(f'/api/sets/{set_id}').get_json()
    quiz_ids = [q['id'] for q in set_data['quizzes']]
    assert quiz_id in quiz_ids


def test_import_quiz_into_set_with_preview(client, sample_quiz):
    set_resp = client.post('/api/sets', json={'name': 'Target Set'})
    set_id = set_resp.get_json()['id']

    sample_quiz['set_id'] = set_id
    quiz_resp = client.post('/api/quizzes', json=sample_quiz)
    quiz_id = quiz_resp.get_json()['id']

    set_data = client.get(f'/api/sets/{set_id}').get_json()
    matching = [q for q in set_data['quizzes'] if q['id'] == quiz_id]
    assert len(matching) == 1
    q = matching[0]
    assert q['title'] == 'Sample Quiz'
    assert q['question_count'] == 2


def test_import_multiple_quizzes_into_set(client, sample_quiz):
    set_resp = client.post('/api/sets', json={'name': 'Multi'})
    set_id = set_resp.get_json()['id']

    for i in range(3):
        q = {**sample_quiz, 'title': f'Quiz {i}', 'set_id': set_id}
        client.post('/api/quizzes', json=q)

    set_data = client.get(f'/api/sets/{set_id}').get_json()
    assert len(set_data['quizzes']) == 3


def test_import_quiz_set_inline(client, sample_set):
    resp = client.post('/api/sets', json=sample_set)
    set_id = resp.get_json()['id']

    set_data = client.get(f'/api/sets/{set_id}').get_json()
    assert len(set_data['quizzes']) == 2
    assert set_data['quizzes'][0]['title'] == 'Quiz 1'
    assert set_data['quizzes'][1]['title'] == 'Quiz 2'
