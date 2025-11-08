// app.js (defensive version)
const docListEl = document.getElementById('doc-list')
const renderArea = document.getElementById('render-area')
const tocList = document.getElementById('toc-list')

function setHTML(el, html) {
    if (!el) return
    el.innerHTML = html
}

async function loadManifest() {
    try {
        const res = await fetch('docs/list.json', {cache: 'no-cache'})
        if (!res.ok) throw new Error(`Manifest load failed: ${res.status}`)
        const list = await res.json()
        return list
    } catch (err) {
        console.error('loadManifest:', err)
        return null
    }
}

function renderSidebar(list) {
    if (!Array.isArray(list) || list.length === 0) {
        setHTML(docListEl, '<li>No docs found. Add docs/list.json and some .md files in docs/</li>')
        return
    }

    docListEl.innerHTML = ''
    list.forEach((doc, i) => {
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.href = '#'
        a.textContent = doc.title || doc.path
        a.dataset.path = doc.path
        a.addEventListener('click', (e) => {
            e.preventDefault()
            document.querySelectorAll('.sidebar a').forEach(x => x.classList.remove('active'))
            a.classList.add('active')
            loadAndRender(doc.path)
            history.replaceState(null, '', `#${encodeURIComponent(doc.path)}`)
        })
        li.appendChild(a)
        docListEl.appendChild(li)

        if (i === 0 && !location.hash) {
            // defer click slightly to allow rendering of sidebar
            setTimeout(() => a.click(), 0)
        }
    })

    if (location.hash) {
        const path = decodeURIComponent(location.hash.slice(1))
        const el = Array.from(document.querySelectorAll('.sidebar a')).find(a => a.dataset.path === path)
        if (el) setTimeout(() => el.click(), 0)
    }
}

async function loadAndRender(path) {
    try {
        setHTML(renderArea, '<p>Loading…</p>')
        const res = await fetch(path)
        if (!res.ok) throw new Error('Failed to load ' + path + ' (' + res.status + ')')
        const md = await res.text()
        renderMarkdown(md)
    } catch (err) {
        console.error('loadAndRender:', err)
        setHTML(renderArea, `<h2>Error</h2><p>Could not load document: ${err.message}</p>`)
        setHTML(tocList, 'No headings')
    }
}

function renderMarkdown(md) {
    // Use marked lexer + custom renderer to attach IDs and collect headings
    const tokens = marked.lexer(md)
    const headings = []
    const renderer = new marked.Renderer()

    renderer.heading = function (text, level, raw) {
        // Defensive: raw might be undefined in some marked versions
        const rawText = (raw || text || '').toString()
        const id = rawText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        headings.push({id, level, text})
        return `<h${level} id="${id}">${text}</h${level}>`
    }

    const html = marked.parser(tokens, {renderer})
    setHTML(renderArea, `<div class="markdown">${html}</div>`)
    renderTOC(headings)
    setupIntersectionObserver()
}

function renderTOC(headings) {
    if (!Array.isArray(headings) || headings.length === 0) {
        setHTML(tocList, 'No headings')
        return
    }
    const ul = document.createElement('ul')
    headings.forEach(h => {
        const li = document.createElement('li')
        li.style.marginLeft = `${(h.level - 1) * 8}px`
        const a = document.createElement('a')
        a.href = `#${h.id}`
        a.textContent = h.text
        a.addEventListener('click', (e) => {
            e.preventDefault()
            const el = document.getElementById(h.id)
            if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'})
        })
        li.appendChild(a)
        ul.appendChild(li)
    })
    setHTML(tocList, '')
    tocList.appendChild(ul)
}

// IntersectionObserver with guards
let observer = null

function setupIntersectionObserver() {
    if (observer) {
        observer.disconnect()
        observer = null
    }

    const root = document.querySelector('.main-area')
    if (!root) return

    const headingsEls = root.querySelectorAll('h1, h2, h3, h4')
    if (!headingsEls || headingsEls.length === 0) {
        // nothing to observe
        return
    }

    const options = {root, rootMargin: '0px 0px -60% 0px', threshold: 0}
    try {
        observer = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting)
            if (visible.length) {
                visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
                const id = visible[0].target.id
                document.querySelectorAll('#toc-list a').forEach(a => {
                    const li = a.parentElement
                    if (!li) return
                    li.classList.toggle('active', a.getAttribute('href') === `#${id}`)
                })
            }
        }, options)

        headingsEls.forEach(h => observer.observe(h))
    } catch (err) {
        console.warn('IntersectionObserver setup failed:', err)
    }
}

// Init
;(async function init() {
    const manifest = await loadManifest()
    if (manifest) {
        renderSidebar(manifest)
    } else {
        renderSidebar([{title: 'Sample', path: 'docs/sample.md'}])
        loadAndRender('docs/sample.md')
    }
})()
