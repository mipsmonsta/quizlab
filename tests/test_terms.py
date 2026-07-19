def test_list_terms_empty(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    resp = client.get(f'/api/sets/{set_id}/terms')
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_create_term(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI', 'note': 'Artificial Intelligence'})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['name'] == 'AI'
    assert data['note'] == 'Artificial Intelligence'
    assert data['quiz_set_id'] == set_id


def test_create_term_duplicate_name(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI', 'note': 'First'})
    resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI', 'note': 'Second'})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['name'] == 'AI'
    assert data['note'] == 'First'


def test_create_term_missing_name(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    resp = client.post(f'/api/sets/{set_id}/terms', json={'note': 'no name'})
    assert resp.status_code == 400


def test_list_terms_after_create(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI', 'note': 'Artificial Intelligence'})
    client.post(f'/api/sets/{set_id}/terms', json={'name': 'ML', 'note': 'Machine Learning'})
    resp = client.get(f'/api/sets/{set_id}/terms')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2
    names = [t['name'] for t in data]
    assert names == ['AI', 'ML']


def test_update_term_note(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    create_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI', 'note': 'Old note'})
    term_id = create_resp.get_json()['id']
    resp = client.put(f'/api/terms/{term_id}', json={'note': 'Updated note'})
    assert resp.status_code == 200
    assert resp.get_json()['note'] == 'Updated note'


def test_delete_term(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    create_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'AI'})
    term_id = create_resp.get_json()['id']
    resp = client.delete(f'/api/terms/{term_id}')
    assert resp.status_code == 200
    terms = client.get(f'/api/sets/{set_id}/terms').get_json()
    assert len(terms) == 0


def test_link_term_to_question(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    question_id = client.get(f'/api/quizzes/{quizzes[0]["id"]}').get_json()['questions'][0]['id']
    term_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Q1', 'note': 'Question one'})
    term_id = term_resp.get_json()['id']
    resp = client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': term_id, 'field': 'question', 'start_pos': 0, 'end_pos': 2,
    })
    assert resp.status_code == 201
    assert resp.get_json()['id'] is not None


def test_unlink_term_from_question(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    question_id = client.get(f'/api/quizzes/{quizzes[0]["id"]}').get_json()['questions'][0]['id']
    term_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Q1'})
    term_id = term_resp.get_json()['id']
    link_resp = client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': term_id, 'field': 'question', 'start_pos': 0, 'end_pos': 2,
    })
    link_id = link_resp.get_json()['id']
    resp = client.delete(f'/api/questions/{question_id}/terms/{link_id}')
    assert resp.status_code == 200
    quiz = client.get(f'/api/quizzes/{quizzes[0]["id"]}').get_json()
    assert len(quiz['questions'][0]['term_links']) == 0


def test_term_links_in_quiz_response(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    quiz_id = quizzes[0]['id']
    question_id = client.get(f'/api/quizzes/{quiz_id}').get_json()['questions'][0]['id']
    term_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Q1', 'note': 'Note text'})
    term_id = term_resp.get_json()['id']
    client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': term_id, 'field': 'question', 'start_pos': 0, 'end_pos': 2,
    })
    quiz = client.get(f'/api/quizzes/{quiz_id}').get_json()
    links = quiz['questions'][0]['term_links']
    assert len(links) == 1
    assert links[0]['term_name'] == 'Q1'
    assert links[0]['note'] == 'Note text'
    assert links[0]['start_pos'] == 0
    assert links[0]['end_pos'] == 2
    assert links[0]['field'] == 'question'


def test_term_links_in_review_response(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    quiz_id = quizzes[0]['id']
    question_id = client.get(f'/api/quizzes/{quiz_id}').get_json()['questions'][0]['id']
    term_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Q1'})
    term_id = term_resp.get_json()['id']
    client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': term_id, 'field': 'option_0', 'start_pos': 1, 'end_pos': 2,
    })
    review = client.get(f'/api/quizzes/{quiz_id}/review').get_json()
    links = review['questions'][0]['term_links']
    assert len(links) == 1
    assert links[0]['field'] == 'option_0'


def test_delete_term_also_removes_links(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    question_id = client.get(f'/api/quizzes/{quizzes[0]["id"]}').get_json()['questions'][0]['id']
    term_resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Q1'})
    term_id = term_resp.get_json()['id']
    client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': term_id, 'field': 'question', 'start_pos': 0, 'end_pos': 2,
    })
    client.delete(f'/api/terms/{term_id}')
    quiz = client.get(f'/api/quizzes/{quizzes[0]["id"]}').get_json()
    assert len(quiz['questions'][0]['term_links']) == 0


def test_get_quiz_set_id_endpoint(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    quizzes = client.get(f'/api/sets/{set_id}').get_json()['quizzes']
    quiz_id = quizzes[0]['id']
    resp = client.get(f'/api/quizzes/{quiz_id}/set-id')
    assert resp.status_code == 200
    assert resp.get_json()['quiz_set_id'] == set_id


def test_terms_scoped_per_set(client, sample_set):
    set1 = client.post('/api/sets', json={'name': 'Set A'}).get_json()['id']
    set2 = client.post('/api/sets', json={'name': 'Set B'}).get_json()['id']
    client.post(f'/api/sets/{set1}/terms', json={'name': 'Term X'})
    client.post(f'/api/sets/{set2}/terms', json={'name': 'Term Y'})
    terms1 = client.get(f'/api/sets/{set1}/terms').get_json()
    terms2 = client.get(f'/api/sets/{set2}/terms').get_json()
    assert len(terms1) == 1 and terms1[0]['name'] == 'Term X'
    assert len(terms2) == 1 and terms2[0]['name'] == 'Term Y'


def test_note_with_newlines(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    note = "line one\n\nline two after blank\nline three"
    resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'MultiLine', 'note': note})
    assert resp.status_code == 201
    assert resp.get_json()['note'] == note
    term_id = resp.get_json()['id']
    fetched = client.get(f'/api/sets/{set_id}/terms').get_json()
    assert fetched[0]['note'] == note
    updated = "new\n\n\ncontent"
    resp2 = client.put(f'/api/terms/{term_id}', json={'note': updated})
    assert resp2.status_code == 200
    assert resp2.get_json()['note'] == updated


def test_note_with_special_chars(client, sample_set):
    set_resp = client.post('/api/sets', json=sample_set)
    set_id = set_resp.get_json()['id']
    note = 'contains "double quotes" and <angle brackets> and & ampersands and \'single quotes\''
    resp = client.post(f'/api/sets/{set_id}/terms', json={'name': 'Special', 'note': note})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['note'] == note
    linked = client.get(f'/api/sets/{set_id}').get_json()
    quiz_id = linked['quizzes'][0]['id']
    question_id = client.get(f'/api/quizzes/{quiz_id}').get_json()['questions'][0]['id']
    client.post(f'/api/questions/{question_id}/terms', json={
        'term_id': data['id'], 'field': 'question', 'start_pos': 0, 'end_pos': 2,
    })
    quiz = client.get(f'/api/quizzes/{quiz_id}').get_json()
    link = quiz['questions'][0]['term_links'][0]
    assert link['note'] == note
    assert link['term_name'] == 'Special'


def test_import_with_term_links(client):
    set_resp = client.post('/api/sets', json={'name': 'Term Set'})
    set_id = set_resp.get_json()['id']
    quiz_data = {
        'title': 'Term Quiz',
        'set_id': set_id,
        'questions': [{
            'question': 'What is AI?',
            'options': ['A', 'B', 'C'],
            'correct': 0,
            'term_links': [{'term_name': 'Artificial Intelligence', 'note': 'AI note', 'field': 'question', 'start': 10, 'end': 12}],
        }],
    }
    resp = client.post('/api/quizzes', json=quiz_data)
    assert resp.status_code == 201
    q = resp.get_json()['questions'][0]
    assert len(q['term_links']) == 1
    assert q['term_links'][0]['term_name'] == 'Artificial Intelligence'
    assert q['term_links'][0]['note'] == 'AI note'
