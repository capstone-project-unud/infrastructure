import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const fixtures = JSON.parse(await readFile(new URL('../.run/browser-fixtures.json', import.meta.url), 'utf8'))
const base = process.env.FRONTEND_URL || 'http://localhost:3000'
const paths = {
 admin: ['/dashboard', '/admin/users', '/admin/interests', '/capstone', '/guidance', '/proposal', '/account'],
 student1: ['/dashboard', '/capstone', '/guidance', '/proposal', '/capstone/' + fixtures.project.id],
 outsider: ['/dashboard', '/capstone/new'],
 lecturer1: ['/dashboard', '/capstone', '/guidance', '/capstone/' + fixtures.project.id],
 coordinator: ['/dashboard', '/finalization', '/admin/interests', '/capstone', '/guidance', '/proposal', '/capstone/' + fixtures.project.id],
 tu: ['/dashboard', '/capstone', '/proposal'],
 koprodi: ['/dashboard', '/capstone', '/guidance'],
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
const blocked = await fetch(base + '/finalization', { headers: { Cookie: fixtures.accounts.tu.cookie }, redirect: 'manual' })
const font = await fetch(base + '/fonts/urbanist-latin.woff2')
assert.equal(font.status, 200, 'Font Urbanist harus tersedia pada build produksi')
assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0, 4).toString(), 'wOF2')
assert.ok([302, 307].includes(blocked.status)); assert.match(blocked.headers.get('location'), /capstone/)
const unauthenticated = await fetch(base + '/guidance', { redirect: 'manual' })
assert.ok([302, 307].includes(unauthenticated.status)); assert.match(unauthenticated.headers.get('location'), /login/)
const origin = await fetch(base + '/api/v1/capstone/projects', { headers: { Origin: 'https://unrelated.example', Cookie: fixtures.accounts.student1.cookie } })
assert.equal(origin.status, 403)
const download = await fetch(base + '/api/v1/capstone/projects/export', { headers: { Cookie: fixtures.accounts.tu.cookie } })
assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /\.xlsx/)
assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 2).toString(), 'PK')
console.log(`PASS: ${count} halaman SSR lintas peran, font Urbanist, redirect akses, proteksi Origin BFF, dan unduhan XLSX melalui BFF. Pemeriksaan ini tidak menjalankan interaksi browser.`)
