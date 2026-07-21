function debounce(fn, ms) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
}

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function statusBadge(at) {
  if (!at) return `<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Not started</span>`
  if (at.status === 'in_progress') return `<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">In progress</span>`
  const pct = Math.round((at.score / at.total) * 100)
  const color = pct >= 70 ? 'green' : pct >= 40 ? 'yellow' : 'red'
  return `<span class="text-xs px-2 py-0.5 rounded-full bg-${color}-100 dark:bg-${color}-900 text-${color}-700 dark:text-${color}-300">${at.score}/${at.total}</span>`
}

// Term data lookup (avoids storing user text in HTML attributes)
const _termData = {}

// Global term-link click handler
document.addEventListener('click', e => {
  const link = e.target.closest('.term-link')
  if (link) {
    e.preventDefault()
    const termId = parseInt(link.dataset.termId)
    const td = _termData[termId]
    if (td) showTermModal({ termName: td.name, note: td.note, termId, mode: 'edit' })
  }
})

// Dismiss popover on outside click
document.addEventListener('mousedown', dismissPopoverOnClick)

// ── Home (quiz sets) ──────────────────────────────────────────

async function renderHome(main) {
  const [sets, ungrouped] = await Promise.all([
    api.listSets(),
    api.listQuizzes('none'),
  ])

  if (!sets.length && !ungrouped.length) {
    main.innerHTML = `
      <div class="text-center py-20 fade-in">
        <div class="text-5xl mb-4 opacity-30">📦</div>
        <h2 class="text-xl font-semibold mb-2">No quiz sets yet</h2>
        <p class="text-gray-500 dark:text-gray-400 mb-6">Create a set to organize your quizzes, or import one from JSON</p>
        <div class="flex gap-3 justify-center">
          <button id="create-set-btn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">+ New Set</button>
          <a href="#/import" class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Import Set</a>
        </div>
      </div>
    `

    document.getElementById('create-set-btn')?.addEventListener('click', () => {
      const name = prompt('Quiz set name:')
      if (!name || !name.trim()) return
      api.createSet({ name: name.trim() }).then(() => render()).catch(e => alert(e.message))
    })
    return
  }

  main.innerHTML = `
    <div class="flex items-center justify-between mb-6 fade-in">
      <h2 class="text-2xl font-bold">Quiz Sets</h2>
      <div class="flex gap-2">
        <button id="create-set-btn" class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">+ New Set</button>
        <a href="#/import" class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Import</a>
      </div>
    </div>
    <div id="set-grid" class="grid gap-4 sm:grid-cols-2 mb-8 fade-in"></div>
  `

  const grid = document.getElementById('set-grid')

  if (!sets.length) {
    grid.innerHTML = '<p class="text-gray-400 col-span-2 text-center py-8">No sets yet. Create one or import a quiz set.</p>'
  }

  for (const s of sets) {
    const card = document.createElement('div')
    card.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow'
    card.dataset.id = s.id

    let statusHtml = ''
    if (s.completed > 0 && s.completed === s.total) {
      statusHtml = `<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">All done</span>`
    } else if (s.in_progress > 0) {
      statusHtml = `<span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">${s.in_progress} in progress</span>`
    } else {
      statusHtml = `<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">${s.total} quizzes</span>`
    }

    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <h3 class="font-semibold text-lg leading-tight">${esc(s.name)}</h3>
        ${statusHtml}
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        ${s.total} quiz${s.total !== 1 ? 'zes' : ''}
        ${s.date ? ` · ${esc(s.date)}` : ''}
      </p>
    `

    card.addEventListener('click', () => navigate(`#/set/${s.id}`))

    // Delete button overlay
    const delBtn = document.createElement('button')
    delBtn.className = 'absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity'
    delBtn.textContent = '✕'
    delBtn.title = 'Delete set'
    delBtn.addEventListener('click', async e => {
      e.stopPropagation()
      if (!confirm(`Delete set "${s.name}"? Quizzes will be unlinked.`)) return
      await api.deleteSet(s.id)
      render()
    })
    card.style.position = 'relative'
    card.classList.add('group')
    card.appendChild(delBtn)

    grid.appendChild(card)
  }

  document.getElementById('create-set-btn')?.addEventListener('click', () => {
    const name = prompt('Quiz set name:')
    if (!name || !name.trim()) return
    api.createSet({ name: name.trim() }).then(() => render()).catch(e => alert(e.message))
  })

  // Ungrouped quizzes
  if (ungrouped.length) {
    const section = document.createElement('div')
    section.innerHTML = `
      <h3 class="text-lg font-semibold mb-3 text-gray-500 dark:text-gray-400">Ungrouped</h3>
      <div id="ungrouped-grid" class="grid gap-3 sm:grid-cols-2"></div>
    `
    main.appendChild(section)

    const ugGrid = document.getElementById('ungrouped-grid')
    for (const q of ungrouped) {
      const card = document.createElement('div')
      card.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm'
      card.innerHTML = `
        <div class="flex items-start justify-between mb-2">
          <h4 class="font-semibold leading-tight">${esc(q.title)}</h4>
          ${statusBadge(q.latest_attempt)}
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">${q.question_count} question${q.question_count !== 1 ? 's' : ''}</p>
        <div class="flex gap-2 flex-wrap">
          ${!q.latest_attempt || q.latest_attempt.status === 'completed'
            ? `<button class="take-btn px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors" data-id="${q.id}">${!q.latest_attempt ? 'Take' : 'Re-take'}</button>`
            : `<button class="take-btn px-3 py-1 text-xs font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors" data-id="${q.id}">Resume</button>`
          }
          ${q.latest_attempt ? `<button class="review-btn px-3 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-id="${q.id}">Review</button>` : ''}
          <button class="delete-btn px-3 py-1 text-xs font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-id="${q.id}">✕</button>
        </div>
      `
      ugGrid.appendChild(card)
    }

    ugGrid.addEventListener('click', async e => {
      const take = e.target.closest('.take-btn')
      const review = e.target.closest('.review-btn')
      const del = e.target.closest('.delete-btn')
      if (take) navigate(`#/quiz/${take.dataset.id}`)
      if (review) navigate(`#/review/${review.dataset.id}`)
      if (del) {
        if (!confirm('Delete this quiz permanently?')) return
        await api.deleteQuiz(del.dataset.id)
        render()
      }
    })
  }
}


// ── Set detail ───────────────────────────────────────────────

async function renderSetDetail(main, setId) {
  const setData = await api.getSet(setId)
  const quizzes = setData.quizzes || []

  main.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <a href="#/" class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-block">← All sets</a>
          <h2 class="text-2xl font-bold">${esc(setData.name)}</h2>
          ${setData.date ? `<p class="text-sm text-gray-500 dark:text-gray-400">${esc(setData.date)}</p>` : ''}
        </div>
        <div class="flex gap-2">
          <a href="#/set/${setId}/glossary" class="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Glossary</a>
          <a href="#/import?set_id=${setId}" class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">+ Add quiz</a>
          <button id="delete-set-btn" class="px-3 py-1.5 text-sm font-medium rounded-lg text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Delete set</button>
        </div>
      </div>

      ${!quizzes.length
        ? '<p class="text-gray-400 text-center py-12">No quizzes in this set yet. Import one!</p>'
        : `<div id="quiz-grid" class="grid gap-4 sm:grid-cols-2"></div>`
      }
    </div>
  `

  if (!quizzes.length) return

  const grid = document.getElementById('quiz-grid')
  for (const q of quizzes) {
    const card = document.createElement('div')
    card.className = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm'
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <h3 class="font-semibold text-lg leading-tight">${esc(q.title)}</h3>
        ${statusBadge(q.latest_attempt)}
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">${q.question_count} question${q.question_count !== 1 ? 's' : ''}</p>
      ${q.time_limit_seconds ? `<p class="text-sm text-gray-500 dark:text-gray-400 mb-3">⏱ ${fmtTime(q.time_limit_seconds)} limit</p>` : '<p class="mb-3"></p>'}
      <div class="flex gap-2 flex-wrap">
        ${!q.latest_attempt || q.latest_attempt.status === 'completed'
          ? `<button class="take-btn flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors" data-id="${q.id}">${!q.latest_attempt ? 'Take quiz' : 'Re-take'}</button>`
          : `<button class="take-btn flex-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors" data-id="${q.id}">Resume</button>`
        }
        ${q.latest_attempt ? `<button class="review-btn px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-id="${q.id}">Review</button>` : ''}
        <button class="delete-btn px-3 py-1.5 text-sm font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" data-id="${q.id}" title="Delete quiz">✕</button>
      </div>
    `
    grid.appendChild(card)
  }

  grid.addEventListener('click', async e => {
    const take = e.target.closest('.take-btn')
    const review = e.target.closest('.review-btn')
    const del = e.target.closest('.delete-btn')
    if (take) navigate(`#/quiz/${take.dataset.id}`)
    if (review) navigate(`#/review/${review.dataset.id}`)
    if (del) {
      if (!confirm('Delete this quiz permanently?')) return
      await api.deleteQuiz(del.dataset.id)
      render()
    }
  })

  document.getElementById('delete-set-btn')?.addEventListener('click', async () => {
    if (!confirm(`Delete set "${setData.name}"? Quizzes will be unlinked.`)) return
    await api.deleteSet(setId)
    navigate('#/')
  })
}

// ── Import ────────────────────────────────────────────────────

async function renderImport(main, preselectedSetId) {
  const sets = await api.listSets().catch(() => [])

  main.innerHTML = `
    <h2 class="text-2xl font-bold mb-6 fade-in">Import</h2>
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 fade-in">
      <label class="block text-sm font-medium mb-2">Paste JSON</label>
      <textarea id="json-input" rows="8" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm font-mono bg-white dark:bg-gray-900 dark:text-gray-100 resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" placeholder='Paste your NotebookLM quiz JSON here...'></textarea>
      <div class="flex items-center gap-3 mt-3">
        <label class="cursor-pointer text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          Or upload file
          <input type="file" id="file-input" accept=".json" class="hidden">
        </label>
        <button id="preview-btn" class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50" disabled>Preview</button>
      </div>
      <p id="import-error" class="text-red-500 text-sm mt-2 hidden"></p>
    </div>
    <details class="mb-6 fade-in">
      <summary class="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none">
        Need the JSON format? Click to show examples
      </summary>
      <div class="mt-3 space-y-4">
        <div>
          <h4 class="text-sm font-semibold mb-1">Single Quiz</h4>
          <pre class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto border border-gray-200 dark:border-gray-700"><code>{
  "title": "Topic Quiz",
  "description": "Optional description",
  "time_limit_seconds": 600,
  "questions": [
    {
      "question": "What is 2+2?",
      "options": ["3", "4", "5", "6"],
      "correct": 1,
      "explanation": "2+2 = 4"
    },
    {
      "question": "What color is the sky?",
      "options": ["Red", "Blue", "Green", "Yellow"],
      "correct_answer": "Blue",
      "explanation": "The sky appears blue due to Rayleigh scattering"
    }
  ]
}</code></pre>
          <p class="text-xs text-gray-400 mt-1">Also accepted: <code>quiz_title</code> (alias for <code>title</code>), <code>question_text</code> (alias for <code>question</code>), <code>correct_answer</code> (text) or <code>correct</code> (0-based index).</p>
        </div>
        <div>
          <h4 class="text-sm font-semibold mb-1">Quiz Set (multiple quizzes at once)</h4>
          <pre class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs overflow-x-auto border border-gray-200 dark:border-gray-700"><code>{
  "set_name": "Week 1 Review",
  "set_date": "2026-07-16",
  "quizzes": [
    {
      "title": "Quiz 1",
      "questions": [
        { "question": "Q1?", "options": ["A", "B"], "correct": 0 }
      ]
    },
    {
      "title": "Quiz 2",
      "time_limit_seconds": 300,
      "questions": [
        { "question": "Q2?", "options": ["X", "Y", "Z"], "correct_answer": "Y" }
      ]
    }
  ]
}</code></pre>
        </div>
      </div>
    </details>
    <div id="import-preview" class="hidden"></div>
  `

  const textarea = document.getElementById('json-input')
  const fileInput = document.getElementById('file-input')
  const previewBtn = document.getElementById('preview-btn')
  const errorEl = document.getElementById('import-error')

  textarea.addEventListener('input', () => {
    previewBtn.disabled = !textarea.value.trim()
    errorEl.classList.add('hidden')
  })

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      textarea.value = reader.result
      previewBtn.disabled = false
      errorEl.classList.add('hidden')
    }
    reader.readAsText(file)
  })

  previewBtn.addEventListener('click', () => {
    try {
      const data = JSON.parse(textarea.value)
      const hasQuizTitle = data.title || data.quiz_title

      if (data.set_name && Array.isArray(data.quizzes) && data.quizzes.length) {
        errorEl.classList.add('hidden')
        showSetImportPreview(data)
      } else if (hasQuizTitle && Array.isArray(data.questions) && data.questions.length) {
        errorEl.classList.add('hidden')
        showQuizImportPreview(data, sets, preselectedSetId)
      } else {
        throw new Error('JSON must have "set_name"+"quizzes[]" or "title/quiz_title"+"questions[]"')
      }
    } catch (e) {
      errorEl.textContent = e.message
      errorEl.classList.remove('hidden')
    }
  })
}

function showQuizImportPreview(data, sets, preselectedSetId) {
  const container = document.getElementById('import-preview')
  container.classList.remove('hidden')

  const title = data.title || data.quiz_title || 'Untitled Quiz'
  const setOptions = sets.map(s =>
    `<option value="${s.id}" ${s.id === preselectedSetId ? 'selected' : ''}>${esc(s.name)}</option>`
  ).join('')

  container.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 fade-in">
      <h3 class="font-semibold text-lg mb-1">${esc(title)}</h3>
      ${data.description ? `<p class="text-sm text-gray-500 dark:text-gray-400 mb-2">${esc(data.description)}</p>` : ''}
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        ${data.questions.length} question${data.questions.length !== 1 ? 's' : ''}
        ${data.time_limit_seconds ? ` · ⏱ ${fmtTime(data.time_limit_seconds)}` : ''}
      </p>
      <div class="max-h-48 overflow-y-auto mb-4 space-y-1 text-sm">
        ${data.questions.map((q, i) =>
          `<div class="flex items-center gap-2 py-1 px-2 rounded ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''}">
            <span class="font-mono text-xs text-gray-400">${i + 1}</span>
            <span>${esc(q.question_text || q.question || '')}</span>
          </div>`
        ).join('')}
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Add to set</label>
        <select id="set-select" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-white dark:bg-gray-900 dark:text-gray-100">
          <option value="">— No set (ungrouped) —</option>
          ${setOptions}
        </select>
      </div>
      <div class="flex gap-2">
        <button id="save-quiz-btn" class="px-5 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Save Quiz</button>
        <button id="cancel-preview-btn" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
      </div>
    </div>
  `

  document.getElementById('save-quiz-btn').addEventListener('click', async () => {
    try {
      const setSelect = document.getElementById('set-select')
      const payload = { ...data, set_id: setSelect.value ? parseInt(setSelect.value) : null }
      await api.importQuiz(payload)
      navigate('#/')
    } catch (e) {
      alert('Failed to save: ' + e.message)
    }
  })

  document.getElementById('cancel-preview-btn').addEventListener('click', () => {
    container.classList.add('hidden')
  })
}

function showSetImportPreview(data) {
  const container = document.getElementById('import-preview')
  container.classList.remove('hidden')

  container.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 fade-in">
      <h3 class="font-semibold text-lg mb-1">Set: ${esc(data.set_name)}</h3>
      ${data.set_date ? `<p class="text-sm text-gray-500 dark:text-gray-400 mb-2">${esc(data.set_date)}</p>` : ''}
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        ${data.quizzes.length} quiz${data.quizzes.length !== 1 ? 'zes' : ''}
      </p>
      <div class="max-h-48 overflow-y-auto mb-4 space-y-1 text-sm">
        ${data.quizzes.map((qz, i) =>
          `<div class="flex items-center gap-2 py-1 px-2 rounded ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''}">
            <span class="font-mono text-xs text-gray-400">${i + 1}</span>
            <span>${esc(qz.title)} (${qz.questions.length} q)</span>
          </div>`
        ).join('')}
      </div>
      <div class="flex gap-2">
        <button id="save-set-btn" class="px-5 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Save Set</button>
        <button id="cancel-preview-btn" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
      </div>
    </div>
  `

  document.getElementById('save-set-btn').addEventListener('click', async () => {
    try {
      await api.createSet({
        name: data.set_name,
        date: data.set_date || null,
        quizzes: data.quizzes,
      })
      navigate('#/')
    } catch (e) {
      alert('Failed to save set: ' + e.message)
    }
  })

  document.getElementById('cancel-preview-btn').addEventListener('click', () => {
    container.classList.add('hidden')
  })
}

// ── Quiz (take) ───────────────────────────────────────────────

async function renderQuiz(main, quizId) {
  // Load or create attempt
  let attempt
  try { attempt = await api.getLatestAttempt(quizId) } catch (_) {}
  if (!attempt || attempt.status === 'completed') {
    attempt = await api.startAttempt(quizId)
  }

  const quiz = await api.getQuiz(quizId)
  const questions = quiz.questions
  questions.forEach(q => {
    if (!Array.isArray(q.options)) q.options = []
  })
  const timeLimit = quiz.time_limit_seconds
  const answers = attempt.answers || {}
  let currentIdx = attempt.current_question || 0

  let remaining = timeLimit || 0
  if (timeLimit && attempt.started_at) {
    const elapsed = Math.floor((Date.now() - new Date(attempt.started_at + 'Z').getTime()) / 1000)
    remaining = Math.max(0, timeLimit - elapsed)
  }

  let timerInterval = null
  let timerPaused = false
  let submitting = false
  let cleanup = () => { if (timerInterval) clearInterval(timerInterval); timerInterval = null }

  function pauseTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
      timerPaused = true
    }
  }

  function resumeTimer() {
    if (timerPaused && remaining > 0) {
      timerPaused = false
      timerInterval = setInterval(() => {
        remaining--
        renderQuestion()
        if (remaining <= 0) {
          clearInterval(timerInterval)
          timerInterval = null
          submitQuiz(true)
        }
      }, 1000)
    }
  }

  const saveDebounced = debounce(async () => {
    try { await api.saveProgress(quizId, { answers, current_question: currentIdx }) } catch (_) {}
  }, 800)

  function saveNow() {
    api.saveProgress(quizId, { answers, current_question: currentIdx }).catch(() => {})
  }

  function renderQuestion() {
    const q = questions[currentIdx]
    const total = questions.length
    const answeredCount = questions.filter(qq => answers[qq.id] !== undefined).length
    const answered = answers[q.id] !== undefined
    const isCorrect = answered && answers[q.id] === q.correct

    const questionTermLinks = (q.term_links || []).filter(tl => tl.field === 'question')
    const optTermLinks = {}
    q.options.forEach((_, oi) => {
      optTermLinks[oi] = (q.term_links || []).filter(tl => tl.field === `option_${oi}`)
    })

    // Progress dots
    const dots = questions.map((qq, i) =>
      `<div class="progress-dot ${answers[qq.id] !== undefined ? 'answered' : 'unanswered'} ${i === currentIdx ? 'current' : ''}" data-idx="${i}"></div>`
    ).join('')

    // Timer
    let timerHtml = ''
    if (timeLimit) {
      const urgent = remaining <= 60
      timerHtml = `<span class="font-mono tabular-nums ${urgent ? 'timer-urgent' : 'text-gray-500 dark:text-gray-400'}">⏱ ${fmtTime(remaining)}</span>`
    }

    // Options with immediate feedback
    const optionsHtml = q.options.map((opt, oi) => {
      let btnClass = 'option-btn w-full text-left px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 mb-2'
      let badgeClass = 'inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-medium mr-3'

      if (answered) {
        if (oi === q.correct) {
          btnClass += ' correct border-green-500'
          badgeClass += ' bg-green-500 text-white border-green-500'
        } else if (oi === answers[q.id]) {
          btnClass += ' wrong border-red-500'
          badgeClass += ' bg-red-500 text-white border-red-500'
        } else {
          badgeClass += ' border-gray-300 dark:border-gray-500'
        }
      } else {
        if (oi === answers[q.id]) {
          btnClass += ' selected border-blue-500'
          badgeClass += ' bg-blue-500 text-white border-blue-500'
        } else {
          badgeClass += ' border-gray-300 dark:border-gray-500'
        }
      }

      return `<button class="${btnClass}" data-oi="${oi}" ${answered ? 'disabled' : ''}>
        <span class="${badgeClass}">${String.fromCharCode(65 + oi)}</span>
        ${renderRichText(opt, optTermLinks[oi])}
      </button>`
    }).join('')

    // Feedback banner
    let feedbackHtml = ''
    if (answered) {
      feedbackHtml = `
        <div class="mt-4 flex items-center gap-2 text-sm font-medium ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
          ${isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </div>
      `
    }

    // Explanation
    let explanationHtml = ''
    if (answered && q.explanation) {
      explanationHtml = `
        <div class="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-gray-700 dark:text-gray-300">
          ${renderRichText(q.explanation, (q.term_links || []).filter(tl => tl.field === 'explanation'))}
        </div>
      `
    }

    main.innerHTML = `
      <div class="fade-in">
        <div class="flex items-center justify-between mb-1">
          <h2 class="font-semibold text-lg truncate">${esc(quiz.title)}</h2>
          <div class="flex items-center gap-3 text-sm">
            ${timerHtml}
            <span class="text-gray-500 dark:text-gray-400">${currentIdx + 1}/${total}</span>
          </div>
        </div>

        <div class="flex gap-1.5 mb-6 overflow-x-auto pb-1" id="progress-dots">${dots}</div>

        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Question ${currentIdx + 1} of ${total} · ${answeredCount} answered</p>
          <p id="question-text" class="text-lg font-medium mb-5 leading-relaxed">${renderRichText(q.question, questionTermLinks)}</p>
          <div id="options-container">${optionsHtml}</div>
          ${feedbackHtml}
          ${explanationHtml}
        </div>

        <div class="flex items-center justify-between">
          <button id="prev-btn" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${currentIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''}" ${currentIdx === 0 ? 'disabled' : ''}>← Previous</button>
          ${currentIdx === total - 1
            ? `<button id="submit-btn" class="px-6 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Submit →</button>`
            : `<button id="next-btn" class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Next →</button>`
          }
        </div>
      </div>
    `

    // Event listeners
    const optionsContainer = document.getElementById('options-container')
    const prevBtn = document.getElementById('prev-btn')
    const nextBtn = document.getElementById('next-btn')
    const submitBtn = document.getElementById('submit-btn')
    const dotsContainer = document.getElementById('progress-dots')
    const questionText = document.getElementById('question-text')

    if (optionsContainer) {
      optionsContainer.addEventListener('click', e => {
        const btn = e.target.closest('.option-btn')
        if (!btn || btn.disabled) return
        const oi = parseInt(btn.dataset.oi)
        answers[q.id] = oi
        saveDebounced()
        renderQuestion()
      })
    }

    if (dotsContainer) {
      dotsContainer.addEventListener('click', e => {
        const dot = e.target.closest('.progress-dot')
        if (!dot) return
        currentIdx = parseInt(dot.dataset.idx)
        renderQuestion()
      })
    }

    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', () => { currentIdx--; renderQuestion() })
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => { currentIdx++; renderQuestion() })
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', submitQuiz)
    }

    // Term selection on question text
    if (quiz.quiz_set_id) {
      setupTermSelection(questionText, quiz.quiz_set_id, q.id, 'question', pauseTimer, resumeTimer)
    }
  }

  async function submitQuiz(auto = false) {
    if (submitting) return
    if (!auto && !confirm('Submit your answers?')) return
    submitting = true
    cleanup()
    saveNow()
    await new Promise(r => setTimeout(r, 300))
    const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at + 'Z').getTime()) / 1000)
    try {
      const result = await api.submitAttempt(quizId, { answers, time_taken_seconds: timeTaken })
      state.lastResults = result
      navigate(`#/results/${quizId}`)
    } catch (e) {
      submitting = false
      alert('Failed to submit: ' + e.message)
    }
  }

  // Timer
  if (timeLimit && remaining > 0) {
    timerInterval = setInterval(() => {
      remaining--
      renderQuestion()
      if (remaining <= 0) {
        clearInterval(timerInterval)
        timerInterval = null
        submitQuiz(true)
      }
    }, 1000)
  }

  renderQuestion()
  return cleanup
}

// ── Results ───────────────────────────────────────────────────

async function renderResults(main, quizId) {
  let results = state.lastResults
  let attempt, quiz

  try {
    attempt = await api.getLatestAttempt(quizId)
    quiz = await api.reviewQuiz(quizId)
  } catch (e) {
    main.innerHTML = `<p class="text-red-500">Failed to load results: ${e.message}</p>`
    return
  }

  if (!results || results.attempt.quiz_id !== quizId) {
    // Reconstruct from stored data
    const answers = attempt.answers || {}
    const questions = quiz.questions
    questions.forEach(q => { if (!Array.isArray(q.options)) q.options = [] })
    const correctCount = attempt.score || 0
    const resultsList = questions.map(q => ({
      question: q,
      selected: answers[q.id],
      correct: answers[q.id] === q.correct
    }))
    results = { attempt, results: resultsList, score: correctCount, total: attempt.total }
  }

  const r = results
  const pct = Math.round((r.score / r.total) * 100)
  const passed = pct >= 70
  const timeStr = r.attempt.time_taken_seconds ? fmtTime(r.attempt.time_taken_seconds) : '--'

  main.innerHTML = `
    <div class="fade-in">
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold mb-1">${esc(quiz.title)}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Results</p>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 mb-6 text-center">
        <div class="text-5xl mb-3">${passed ? '✅' : '❌'}</div>
        <div class="text-4xl font-bold mb-1">${r.score} / ${r.total}</div>
        <div class="text-lg mb-3 ${pct >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">${pct}%</div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Time: ${timeStr}</p>
      </div>

      <div class="space-y-3">
        ${r.results.map((res, i) => {
          const q = res.question
          const qTermLinks = (q.term_links || []).filter(tl => tl.field === 'question')
          const selectedLabel = res.selected !== undefined && res.selected !== null ? q.options[res.selected] || '(skipped)' : '(skipped)'
          const correctLabel = q.options[q.correct]
          const selectedTermLinks = res.selected !== undefined && res.selected !== null ? (q.term_links || []).filter(tl => tl.field === 'option_' + res.selected) : []
          const correctTermLinks = (q.term_links || []).filter(tl => tl.field === 'option_' + q.correct)
          return `
            <div class="bg-white dark:bg-gray-800 rounded-xl border ${res.correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'} p-4">
              <div class="flex items-start gap-3">
                <span class="text-lg mt-0.5">${res.correct ? '✅' : '❌'}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium mb-2">${renderRichText(q.question, qTermLinks)}</p>
                  <div class="text-sm space-y-1">
                    <p class="${res.correct ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                      Your answer: ${renderRichText(selectedLabel, selectedTermLinks)}
                    </p>
                    ${!res.correct ? `<p class="text-green-600 dark:text-green-400">Correct: ${renderRichText(correctLabel, correctTermLinks)}</p>` : ''}
                  </div>
                  ${q.explanation ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">${renderRichText(q.explanation, (q.term_links || []).filter(tl => tl.field === 'explanation'))}</p>` : ''}
                </div>
              </div>
            </div>
          `
        }).join('')}
      </div>

      <div class="flex gap-3 mt-6 justify-center">
        <button id="retake-btn" class="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">Re-take</button>
        <button id="review-results-btn" class="px-5 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Review answers</button>
        <a href="#/" class="px-5 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Back to home</a>
      </div>
    </div>
  `

  document.getElementById('retake-btn')?.addEventListener('click', () => navigate(`#/quiz/${quizId}`))
  document.getElementById('review-results-btn')?.addEventListener('click', () => navigate(`#/review/${quizId}`))
}

// ── Review ────────────────────────────────────────────────────

async function renderReview(main, quizId) {
  let quiz
  try {
    quiz = await api.reviewQuiz(quizId)
  } catch (e) {
    main.innerHTML = `<p class="text-red-500">${e.message}</p>`
    return
  }

  (quiz.questions || []).forEach(q => { if (!Array.isArray(q.options)) q.options = [] })

  const attempt = await api.getLatestAttempt(quizId).catch(() => null)
  const answers = attempt?.answers || {}

  const quizSetId = quiz.quiz_set_id

  main.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold">${esc(quiz.title)}</h2>
        <a href="#/" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Back</a>
      </div>

      <div class="space-y-4">
        ${quiz.questions.map((q, i) => {
          const selected = answers[q.id]
          const selectedLabel = selected !== undefined && selected !== null ? q.options[selected] : '(not answered)'
          const correctLabel = q.options[q.correct]
          const isCorrect = selected === q.correct
          const qTermLinks = (q.term_links || []).filter(tl => tl.field === 'question')
          return `
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-start gap-3">
                <span class="text-sm font-mono text-gray-400 mt-0.5">${i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium mb-3 question-review-text">${renderRichText(q.question, qTermLinks)}</p>
                  <div class="space-y-2 mb-3">
                    ${q.options.map((opt, oi) => {
                      const optTermLinks = (q.term_links || []).filter(tl => tl.field === 'option_' + oi)
                      let cls = 'border-gray-200 dark:border-gray-600'
                      let extra = ''
                      if (oi === q.correct) { cls = 'border-green-500 bg-green-50 dark:bg-green-900/20'; extra = ' ✓' }
                      else if (oi === selected && oi !== q.correct) { cls = 'border-red-500 bg-red-50 dark:bg-red-900/20'; extra = ' ✗' }
                      return `<div class="flex items-center px-3 py-2 rounded-lg border text-sm ${cls}">
                        <span class="w-6 h-6 flex items-center justify-center rounded-full border text-xs font-medium mr-3 ${oi === q.correct ? 'border-green-500 bg-green-500 text-white' : oi === selected ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300 dark:border-gray-500'}">${String.fromCharCode(65 + oi)}</span>
                        <span class="option-review-text">${renderRichText(opt, optTermLinks)}${extra}</span>
                      </div>`
                    }).join('')}
                  </div>
                  ${q.explanation ? `<p class="text-sm text-gray-500 dark:text-gray-400 italic">${renderRichText(q.explanation, (q.term_links || []).filter(tl => tl.field === 'explanation'))}</p>` : ''}
                </div>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `

  // Set up term selection on review question text and option text
  if (quizSetId) {
    setTimeout(() => {
      document.querySelectorAll('.question-review-text').forEach((el, i) => {
        setupTermSelection(el, quizSetId, quiz.questions[i].id, 'question')
      })
      document.querySelectorAll('.option-review-text').forEach((el, i) => {
        let qIdx = 0, oi = i
        // figure out which question/option this belongs to
        const qContainers = document.querySelectorAll('.question-review-text')
        let count = 0
        for (let qi = 0; qi < qContainers.length; qi++) {
          const qOpts = qContainers[qi].closest('.flex-1')?.querySelectorAll('.option-review-text') || []
          if (count + qOpts.length > i) {
            qIdx = qi
            oi = i - count
            break
          }
          count += qOpts.length
        }
        const q = quiz.questions[qIdx]
        if (q) {
          setupTermSelection(el, quizSetId, q.id, 'option_' + oi)
        }
      })
    }, 50)
  }
}

function esc(s) {
  if (s == null) return ''
  const div = document.createElement('div')
  div.textContent = String(s)
  return div.innerHTML
}

function escLines(s) {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/(?:\r\n|\r|\n)/g, '<br>')
}

// ── Term utilities ────────────────────────────────────────────

function renderRichText(text, termLinks) {
  if (!termLinks || termLinks.length === 0) return esc(text)
  const sorted = [...termLinks].sort((a, b) => a.start_pos - b.start_pos)
  let result = ''
  let pos = 0
  for (const tl of sorted) {
    if (tl.start_pos > pos) {
      result += esc(text.slice(pos, tl.start_pos))
    }
    _termData[tl.term_id] = { name: tl.term_name, note: tl.note }
    result += `<a class="term-link" data-term-id="${tl.term_id}">${esc(text.slice(tl.start_pos, tl.end_pos))}</a>`
    pos = tl.end_pos
  }
  if (pos < text.length) {
    result += esc(text.slice(pos))
  }
  return result
}

function getTextOffset(container, node, offset) {
  let charCount = 0
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  while (walker.nextNode()) {
    if (walker.currentNode === node) return charCount + offset
    charCount += walker.currentNode.textContent.length
  }
  return charCount + offset
}

let _pendingTermSel = null

function showTermModal({ termName, note, termId, mode, quizSetId, questionId, field, startPos, endPos, pauseTimer, resumeTimer }) {
  if (pauseTimer) pauseTimer()
  const overlay = document.createElement('div')
  overlay.className = 'term-modal-overlay'
  overlay.id = 'term-modal-overlay'
  const isNew = mode === 'create'
  overlay.innerHTML = `
    <div class="term-modal">
      <h3>${isNew ? esc('Create term: ' + termName) : esc(termName)}</h3>
      ${!isNew ? `<p class="note-text">${note ? escLines(note) : '<span class="text-gray-400 italic">No note yet</span>'}</p>` : ''}
      <p class="text-sm text-gray-500 mb-2">Note:</p>
      <textarea id="term-note-input" placeholder="Write a note to help you remember this concept..."></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;align-items:center">
        ${!isNew ? `<button id="term-delete-btn" style="margin-right:auto;color:#ef4444;background:none;border:none;cursor:pointer;font-size:13px;padding:4px 8px">Delete</button>` : ''}
        <button id="term-cancel-btn" class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
        <button id="term-save-btn" class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">${isNew ? 'Create' : 'Save'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  const textarea = document.getElementById('term-note-input')
  if (textarea) textarea.value = note || ''

  document.getElementById('term-save-btn').addEventListener('click', async () => {
    const newNote = document.getElementById('term-note-input').value
    if (isNew) {
      try {
        const term = await api.createTerm(quizSetId, { name: termName, note: newNote })
        if (questionId != null) {
          await api.linkTerm(questionId, { term_id: term.id, field, start_pos: startPos, end_pos: endPos })
        }
      } catch (e) { alert('Failed to create term: ' + e.message) }
    } else {
      try { await api.updateTerm(termId, { note: newNote }) } catch (e) { alert('Failed to update note: ' + e.message) }
    }
    dismissTermModal()
    if (resumeTimer) resumeTimer()
    render()
  })

  document.getElementById('term-cancel-btn').addEventListener('click', () => {
    dismissTermModal()
    if (resumeTimer) resumeTimer()
  })

  const delBtn = document.getElementById('term-delete-btn')
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this term and unlink it from all questions?')) return
      try { await api.deleteTerm(termId) } catch (e) { alert('Failed to delete: ' + e.message) }
      dismissTermModal()
      if (resumeTimer) resumeTimer()
      render()
    })
  }

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { dismissTermModal(); if (resumeTimer) resumeTimer() }
  })

  setTimeout(() => document.getElementById('term-note-input')?.focus(), 100)
}

function dismissTermModal() {
  const overlay = document.getElementById('term-modal-overlay')
  if (overlay) overlay.remove()
}

function setupTermSelection(container, quizSetId, questionId, field, pauseTimer, resumeTimer) {
  if (!container) return
  container.classList.add('term-enabled')

  container.addEventListener('mouseup', function (e) {
    if (e.target.closest('.term-link')) return
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        document.querySelector('.term-popover')?.remove()
        _pendingTermSel = null
        return
      }
      const text = sel.toString().trim()
      if (text.length === 0) return

      if (!container.contains(sel.getRangeAt(0).commonAncestorContainer)) return

      const range = sel.getRangeAt(0)
      const startPos = getTextOffset(container, range.startContainer, range.startOffset)
      const endPos = startPos + text.length

      document.querySelector('.term-popover')?.remove()

      const popover = document.createElement('div')
      popover.className = 'term-popover'
      popover.textContent = '+ Create term'
      popover.style.left = (e.clientX + 10) + 'px'
      popover.style.top = (e.clientY + 10) + 'px'
      document.body.appendChild(popover)

      _pendingTermSel = { text, startPos, endPos, quizSetId, questionId, field }

      popover.addEventListener('click', () => {
        popover.remove()
        const ps = _pendingTermSel
        _pendingTermSel = null
        if (!ps) return
        showTermModal({
          termName: ps.text, note: '', mode: 'create',
          quizSetId: ps.quizSetId, questionId: ps.questionId,
          field: ps.field, startPos: ps.startPos, endPos: ps.endPos,
          pauseTimer, resumeTimer,
        })
      })
    }, 10)
  })
}

function dismissPopoverOnClick(e) {
  if (!e.target.closest('.term-popover') && !e.target.closest('.term-modal-overlay')) {
    document.querySelector('.term-popover')?.remove()
  }
}

// ── Glossary ──────────────────────────────────────────────────

async function renderGlossary(main, setId) {
  const [setData, terms] = await Promise.all([
    api.getSet(setId),
    api.getSetTerms(setId),
  ])

  main.innerHTML = `
    <div class="fade-in">
      <div class="flex items-center justify-between mb-6">
        <div>
          <a href="#/set/${setId}" class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-block">← ${esc(setData.name)}</a>
          <h2 class="text-2xl font-bold">Glossary</h2>
        </div>
        <button id="add-term-btn" class="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">+ Add term</button>
      </div>

      ${!terms.length
        ? '<p class="text-gray-400 text-center py-12">No terms yet. Select text in a question to create one.</p>'
        : `<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
             <table class="w-full text-sm">
               <thead>
                 <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                   <th class="text-left px-4 py-3 font-medium">Term</th>
                   <th class="text-left px-4 py-3 font-medium">Note</th>
                   <th class="text-right px-4 py-3 font-medium">Actions</th>
                 </tr>
               </thead>
               <tbody>
                  ${terms.map(t => `
                    <tr class="glossary-term-row border-b border-gray-100 dark:border-gray-700/50 cursor-pointer" data-id="${t.id}" data-name="${esc(t.name)}" data-note="${esc(t.note || '')}">
                      <td class="px-4 py-3 font-medium">${esc(t.name)}</td>
                      <td class="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">${t.note ? esc(t.note) : '<span class="italic">No note</span>'}</td>
                      <td class="px-4 py-3 text-right">
                        <button class="edit-term-btn text-blue-600 dark:text-blue-400 hover:underline mr-3" data-id="${t.id}" data-name="${esc(t.name)}" data-note="${esc(t.note || '')}">Edit</button>
                        <button class="delete-term-btn text-red-500 hover:underline" data-id="${t.id}" data-name="${esc(t.name)}">Delete</button>
                      </td>
                    </tr>
                  `).join('')}
               </tbody>
             </table>
           </div>`
      }
    </div>
  `

  document.getElementById('add-term-btn')?.addEventListener('click', () => {
    const name = prompt('Term name:')
    if (!name || !name.trim()) return
    showTermModal({
      termName: name.trim(), note: '', mode: 'create',
      quizSetId: setId, questionId: null, field: 'question',
      startPos: 0, endPos: 0,
    })
  })

  main.addEventListener('click', e => {
    const row = e.target.closest('.glossary-term-row')
    const editBtn = e.target.closest('.edit-term-btn')
    const delBtn = e.target.closest('.delete-term-btn')
    if (editBtn) {
      const { id, name, note } = editBtn.dataset
      showTermModal({ termName: name, note, termId: parseInt(id), mode: 'edit' })
    } else if (delBtn) {
      const id = parseInt(delBtn.dataset.id)
      if (!confirm(`Delete term "${delBtn.dataset.name}"?`)) return
      api.deleteTerm(id).then(() => render()).catch(e => alert(e.message))
    } else if (row && !e.target.closest('button')) {
      const { id, name, note } = row.dataset
      showTermModal({ termName: name, note, termId: parseInt(id), mode: 'edit' })
    }
  })
}
