import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

// Build the existing React templates for Node so public pages and social metadata
// are present in the first HTML response, before any browser JavaScript runs.
const root = process.cwd()
const renderDir = path.join(root, 'node_modules/.cache/skinfox-seo')
await build({
  configFile: false, root, plugins: [react()], logLevel: 'warn',
  build: {
    ssr: path.join(root, 'src/seo/prerender.tsx'), outDir: renderDir, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'prerender.mjs' } },
  },
})
const { renderSeoPages } = await import(pathToFileURL(path.join(renderDir, 'prerender.mjs')).href)
const pages = renderSeoPages()
const template = await readFile(path.join(root, 'dist/index.html'), 'utf8')
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const siteUrl = 'https://skinfox.in'
const absolute = (value) => new URL(value, siteUrl).href
for (const page of pages) {
  const image = absolute(page.metadata.image ?? '/brand/skinfox-logo.png')
  const meta = [
    ['name', 'description', page.metadata.description], ['name', 'robots', 'index,follow,max-image-preview:large'],
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'SkinFox'], ['property', 'og:locale', 'en_IN'],
    ['property', 'og:title', page.metadata.title], ['property', 'og:description', page.metadata.description],
    ['property', 'og:url', absolute(page.path)], ['property', 'og:image', image],
    ['property', 'og:image:alt', page.metadata.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', page.metadata.title],
    ['name', 'twitter:description', page.metadata.description], ['name', 'twitter:image', image],
    ['name', 'twitter:image:alt', page.metadata.imageAlt ?? 'SkinFox — skin, body, hair and scalp care'],
  ]
  const head = `<title>${escapeHtml(page.metadata.title)}</title>\n<link rel="canonical" href="${escapeHtml(absolute(page.path))}" />\n${meta.map(([attribute, name, content]) => `<meta ${attribute}="${name}" content="${escapeHtml(content)}" />`).join('\n')}\n<script id="skinfox-schema" type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': page.metadata.structuredData }).replace(/</g, '\\u003c')}</script>`
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '')
    .replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g, '')
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${page.html}</div><noscript><p style="padding:20px;text-align:center">Enable JavaScript to shop, sign in and use Find My Care. For help, email <a href="mailto:contact@skinfox.in">contact@skinfox.in</a>.</p></noscript>`)
  const destination = path.join(root, 'dist', page.path, 'index.html')
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, html)
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((page) => `  <url><loc>${escapeHtml(absolute(page.path))}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(path.join(root, 'dist/sitemap.xml'), sitemap)
console.log(`Prerendered ${pages.length} public pages and sitemap.xml. Product prices remain live API data.`)
