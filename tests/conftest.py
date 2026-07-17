import pytest
import sqlite3
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import db

_test_conn = sqlite3.connect(':memory:')
_test_conn.row_factory = sqlite3.Row
_test_conn.execute("PRAGMA foreign_keys=ON")

class _NoCloseConn:
    def __init__(self, conn):
        self.__conn = conn
    def __getattr__(self, name):
        return getattr(self.__conn, name)
    def close(self):
        pass

_wrapped = _NoCloseConn(_test_conn)

def _mock_get_conn():
    return _wrapped

db.get_conn = _mock_get_conn

from db import init_db
init_db()

import app as quizlab_app


@pytest.fixture(autouse=True)
def clean_db():
    for table in ['quiz_attempts', 'questions', 'quizzes', 'quiz_sets']:
        _test_conn.execute(f'DELETE FROM {table}')
    _test_conn.execute("DELETE FROM sqlite_sequence")
    _test_conn.commit()
    yield


@pytest.fixture
def client():
    quizlab_app.app.config['TESTING'] = True
    with quizlab_app.app.test_client() as c:
        yield c


@pytest.fixture
def sample_quiz():
    return {
        'title': 'Sample Quiz',
        'description': 'A test quiz',
        'time_limit_seconds': 300,
        'source': 'test',
        'questions': [
            {
                'question': 'What is 2+2?',
                'options': ['3', '4', '5', '6'],
                'correct': 1,
                'explanation': 'Basic math',
            },
            {
                'question': 'What color is the sky?',
                'options': ['Red', 'Blue', 'Green', 'Yellow'],
                'correct': 1,
                'explanation': 'Sky is blue',
            },
        ],
    }


@pytest.fixture
def sample_set():
    return {
        'name': 'Week 1 Review',
        'date': '2026-07-16',
        'quizzes': [
            {
                'title': 'Quiz 1',
                'questions': [
                    {
                        'question': 'Q1?',
                        'options': ['A', 'B', 'C', 'D'],
                        'correct': 0,
                    }
                ],
            },
            {
                'title': 'Quiz 2',
                'questions': [
                    {
                        'question': 'Q2?',
                        'options': ['A', 'B', 'C', 'D'],
                        'correct': 1,
                    }
                ],
            },
        ],
    }
