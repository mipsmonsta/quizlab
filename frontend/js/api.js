class API {
  async request(method, path, body) {
    const opts = { method, headers: {} }
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(path, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || 'Request failed')
    }
    return res.json()
  }

  listQuizzes(setId)      { const q = setId !== undefined ? `?set_id=${setId}` : ''; return this.request('GET', `/api/quizzes${q}`) }
  importQuiz(data)        { return this.request('POST', '/api/quizzes', data) }
  getQuiz(id)             { return this.request('GET', `/api/quizzes/${id}`) }
  reviewQuiz(id)          { return this.request('GET', `/api/quizzes/${id}/review`) }
  deleteQuiz(id)          { return this.request('DELETE', `/api/quizzes/${id}`) }
  startAttempt(qid)       { return this.request('POST', `/api/quizzes/${qid}/start`) }
  saveProgress(qid, data) { return this.request('POST', `/api/quizzes/${qid}/save`, data) }
  submitAttempt(qid, data){ return this.request('POST', `/api/quizzes/${qid}/submit`, data) }
  getLatestAttempt(qid)   { return this.request('GET', `/api/attempts/latest/${qid}`) }
  listSets()              { return this.request('GET', '/api/sets') }
  createSet(data)         { return this.request('POST', '/api/sets', data) }
  getSet(id)              { return this.request('GET', `/api/sets/${id}`) }
  deleteSet(id)           { return this.request('DELETE', `/api/sets/${id}`) }
  getSetTerms(setId)      { return this.request('GET', `/api/sets/${setId}/terms`) }
  createTerm(setId, data) { return this.request('POST', `/api/sets/${setId}/terms`, data) }
  updateTerm(id, data)    { return this.request('PUT', `/api/terms/${id}`, data) }
  deleteTerm(id)          { return this.request('DELETE', `/api/terms/${id}`) }
  linkTerm(qid, data)     { return this.request('POST', `/api/questions/${qid}/terms`, data) }
  unlinkTerm(qid, lid)    { return this.request('DELETE', `/api/questions/${qid}/terms/${lid}`) }
  getQuizSetId(qid)       { return this.request('GET', `/api/quizzes/${qid}/set-id`) }
}

const api = new API()
