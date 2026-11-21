import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const fixtures = JSON.parse(await readFile(new URL('../.run/browser-fixtures.json', import.meta.url), 'utf8'))
const base = process.env.FRONTEND_URL || 'http://localhost:3000'
const paths = {
 koprodi: ['/dashboard', '/capstone', '/proposal', '/sempro', '/reports', '/account'],
 proposalStudent1: ['/proposal', '/sempro'],
 admin: ['/dashboard', '/groups', '/admin/users', '/admin/interests', '/admin/master', '/capstone', '/guidance', '/proposal', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/reports', '/account'],
 student1: ['/dashboard', '/groups', '/capstone', '/guidance', '/proposal', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/capstone/' + fixtures.project.id],
 outsider: ['/dashboard', '/groups', '/capstone/new', '/expo', '/assistant'],
 lecturer1: ['/account', '/proposal', '/dashboard', '/groups', '/capstone', '/guidance', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/capstone/' + fixtures.project.id],
 coordinator: ['/dashboard', '/groups', '/finalization', '/admin/interests', '/admin/master', '/capstone', '/guidance', '/proposal', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/reports', '/capstone/' + fixtures.project.id],
 tu: ['/dashboard', '/capstone', '/proposal', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/reports'],
 lecturerCoordinator: ['/dashboard', '/groups', '/capstone', '/guidance', '/finalization', '/documents', '/sempro', '/final-exam', '/expo', '/assistant', '/reports'],
}
let count = 0
for (const [role, routes] of Object.entries(paths)) {
 for (const path of routes) {
  const response = await fetch(base + path, { headers: { Cookie: fixtures.accounts[role].cookie } })
  assert.equal(response.status, 200, `${role} ${path}`)
  const text = await response.text()
  assert.match(text, /id="main-content"/)
  assert.match(text, /<h1\b/)
  count++
 }
}
const publicLanding = await fetch(base + '/', { redirect: 'manual' })
assert.equal(publicLanding.status, 200, 'Landing page publik harus dapat diakses tanpa login')
const publicHtml = await publicLanding.text()
assert.ok(publicHtml.includes('<h1'), 'Landing page publik harus memuat heading utama')
assert.ok(publicHtml.includes('Pameran Karya'), 'Landing page publik harus menampilkan Pameran Karya Capstone')
const blocked = await fetch(base + '/finalization', { headers: { Cookie: fixtures.accounts.tu.cookie }, redirect: 'manual' })
const font = await fetch(base + '/fonts/urbanist-latin.woff2')
assert.equal(font.status, 200, 'Font Urbanist harus tersedia pada build produksi')
assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0, 4).toString(), 'wOF2')
const koprodiBlocked = await fetch(base + '/finalization', { headers: { Cookie: fixtures.accounts.koprodi.cookie }, redirect: 'manual' }); assert.ok([302, 307].includes(koprodiBlocked.status))
const proposalPage = await (await fetch(base + '/proposal', { headers: { Cookie: fixtures.accounts.proposalStudent1.cookie } })).text(); for (const label of ['Sertifikat kemampuan bahasa Inggris', 'Dokumen B100', 'Dokumen B200', '6 berkas valid']) assert.ok(proposalPage.includes(label), label)
const examPage = await (await fetch(base + '/sempro', { headers: { Cookie: fixtures.accounts.proposalStudent1.cookie } })).text(); assert.ok(examPage.includes('72.00')); assert.ok(examPage.includes('Cetak presensi')); assert.ok(examPage.includes('Cetak berita acara'))
assert.ok([302, 307].includes(blocked.status)); assert.match(blocked.headers.get('location'), /capstone/)
const unauthenticated = await fetch(base + '/guidance', { redirect: 'manual' })
assert.ok([302, 307].includes(unauthenticated.status)); assert.match(unauthenticated.headers.get('location'), /login/)
const origin = await fetch(base + '/api/v1/capstone/projects', { headers: { Origin: 'https://unrelated.example', Cookie: fixtures.accounts.student1.cookie } })
assert.equal(origin.status, 403)
const download = await fetch(base + '/api/v1/capstone/projects/export', { headers: { Cookie: fixtures.accounts.tu.cookie } })
assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /\.xlsx/)
assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 2).toString(), 'PK')
console.log(`PASS: ${count} halaman SSR lintas peran, font Urbanist, redirect akses, proteksi Origin BFF, dan unduhan XLSX melalui BFF. Pemeriksaan ini tidak menjalankan interaksi browser.`)
