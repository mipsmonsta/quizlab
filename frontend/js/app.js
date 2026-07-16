const state = {
  theme: localStorage.getItem('quizlab-theme') || 'light',
  lastResults: null,
}

let currentCleanup = null

function setTheme(theme) {
  state.theme = theme
  localStorage.setItem('quizlab-theme', theme)
  document.documentElement.classList.toggle('dark', theme === 'dark')

  const sun = document.getElementById('theme-icon-sun')
  const moon = document.getElementById('theme-icon-moon')
  if (sun && moon) {
    sun.classList.toggle('hidden', theme === 'dark')
    moon.classList.toggle('hidden', theme === 'light')
  }
}

function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark')
}

function navigate(hash) {
  if (currentCleanup) { currentCleanup(); currentCleanup = null }
  window.location.hash = hash
}

function render() {
  const hash = window.location.hash.slice(1) || '/'
  const main = document.getElementById('app')
  main.innerHTML = '<div class="flex justify-center py-20 text-gray-400">Loading...</div>'

  if (currentCleanup) { currentCleanup(); currentCleanup = null }

  ;(async () => {
    try {
      if (hash === '/' || hash === '') {
        await renderHome(main)
      } else if (hash === '/import') {
        renderImport(main)
      } else if (hash.startsWith('/quiz/')) {
        const id = parseInt(hash.split('/')[2])
        if (isNaN(id)) throw new Error('Invalid quiz ID')
        currentCleanup = await renderQuiz(main, id) || null
      } else if (hash.startsWith('/results/')) {
        const id = parseInt(hash.split('/')[2])
        if (isNaN(id)) throw new Error('Invalid quiz ID')
        await renderResults(main, id)
      } else if (hash.startsWith('/review/')) {
        const id = parseInt(hash.split('/')[2])
        if (isNaN(id)) throw new Error('Invalid quiz ID')
        await renderReview(main, id)
      } else if (hash.startsWith('/set/')) {
        const id = parseInt(hash.split('/')[2])
        if (isNaN(id)) throw new Error('Invalid set ID')
        await renderSetDetail(main, id)
      } else {
        main.innerHTML = '<div class="text-center py-20 text-red-500">Page not found</div>'
      }
    } catch (e) {
      main.innerHTML = `<div class="text-center py-20 text-red-500">Error: ${esc(e.message)}</div>`
    }
  })()
}

document.addEventListener('DOMContentLoaded', () => {
  setTheme(state.theme)
  render()
})

window.addEventListener('hashchange', render)
document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme)
