def test_create_set(client):
    resp = client.post('/api/sets', json={'name': 'My Set', 'date': '2026-07-17'})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['name'] == 'My Set'
    assert data['date'] == '2026-07-17'


def test_create_set_no_date(client):
    resp = client.post('/api/sets', json={'name': 'No Date'})
    assert resp.status_code == 201
    assert resp.get_json()['name'] == 'No Date'
    assert resp.get_json()['date'] is None


def test_create_set_alternative_name_key(client):
    resp = client.post('/api/sets', json={'set_name': 'Alt', 'set_date': '2026-07-16'})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['name'] == 'Alt'
    assert data['date'] == '2026-07-16'


def test_create_set_with_quizzes(client, sample_set):
    resp = client.post('/api/sets', json=sample_set)
    assert resp.status_code == 201
    data = resp.get_json()
    set_id = data['id']

    get_resp = client.get(f'/api/sets/{set_id}')
    assert get_resp.status_code == 200
    quizzes = get_resp.get_json()['quizzes']
    assert len(quizzes) == 2
    assert quizzes[0]['title'] == 'Quiz 1'
    assert quizzes[1]['title'] == 'Quiz 2'
    assert quizzes[0]['question_count'] == 1
    assert quizzes[1]['question_count'] == 1


def test_create_set_missing_name(client):
    resp = client.post('/api/sets', json={'date': '2026-07-16'})
    assert resp.status_code == 400


def test_list_sets(client, sample_set):
    client.post('/api/sets', json={'name': 'Set A'})
    client.post('/api/sets', json=sample_set)

    resp = client.get('/api/sets')
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2


def test_list_sets_with_counts(client, sample_set):
    client.post('/api/sets', json=sample_set)

    resp = client.get('/api/sets')
    data = resp.get_json()
    s = data[0]
    assert s['total'] == 2
    assert s['quiz_count'] == 2


def test_get_set(client, sample_set):
    create = client.post('/api/sets', json=sample_set)
    set_id = create.get_json()['id']

    resp = client.get(f'/api/sets/{set_id}')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['name'] == 'Week 1 Review'
    assert len(data['quizzes']) == 2
    for q in data['quizzes']:
        assert 'id' in q
        assert 'title' in q
        assert 'question_count' in q


def test_get_set_not_found(client):
    resp = client.get('/api/sets/999')
    assert resp.status_code == 404


def test_delete_set(client, sample_set):
    create = client.post('/api/sets', json=sample_set)
    set_id = create.get_json()['id']

    resp = client.delete(f'/api/sets/{set_id}')
    assert resp.status_code == 200

    resp = client.get(f'/api/sets/{set_id}')
    assert resp.status_code == 404


def test_delete_set_unlinks_quizzes(client, sample_set):
    create = client.post('/api/sets', json=sample_set)
    set_id = create.get_json()['id']

    quizzes_before = client.get(f'/api/quizzes?set_id={set_id}').get_json()
    assert len(quizzes_before) == 2

    client.delete(f'/api/sets/{set_id}')

    ungrouped = client.get('/api/quizzes?set_id=none').get_json()
    assert len(ungrouped) == 2
