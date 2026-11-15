import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const env = Object.fromEntries((await readFile(resolve(root, 'infrastructure/.run/verify.env'), 'utf8')).split(/\r?\n/).filter(Boolean).map(l => { const at = l.indexOf('='); return [l.slice(0, at), l.slice(at + 1)] }))
const base = process.env.VERIFY_API_URL || 'http://127.0.0.1:18080'
const origin = process.env.VERIFY_ORIGIN || 'http://localhost:3000'
const usersURL = 'http://127.0.0.1:18082'
const password = 'Verification-only-Password-2026'
let count = 0
async function request(path, { cookie = '', method = 'GET', body, expected = 200, internal = false } = {}) {
 const headers = { Origin: origin, Cookie: cookie }
 if (internal) headers['X-Service-Token'] = env.USER_INTERNAL_TOKEN
 if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
 const response = await fetch((internal ? usersURL : base) + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
 if (response.status !== expected) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${await response.text()}`)
 count++
 return response
}
async function json(path, options) { return (await request(path, options)).json() }
const roles = { admin: ['ADMIN'], coordinator: ['KOORDINATOR_TA'], tu: ['TU'], lecturer1: ['DOSEN'], lecturer2: ['DOSEN'], lecturer3: ['DOSEN'], student1: ['MAHASISWA'], student2: ['MAHASISWA'], outsider: ['MAHASISWA'], koprodi: ['DOSEN', 'KOPRODI'] }
await request('/internal/bootstrap', { method: 'POST', internal: true, expected: 201, body: { full_name: 'Admin Verifikasi', email: 'admin@verify.local', password } })
const accounts = {}
async function login(name) { const res = await request('/api/v1/auth/login', { method: 'POST', body: { email: name + '@verify.local', password } }); const data = await res.json(); return { ...data.user, cookie: res.headers.get('set-cookie').split(';')[0], email: name + '@verify.local', password } }
accounts.admin = await login('admin')
let year = 2023
for (const [name, role] of Object.entries(roles)) { if (name === 'admin') continue; const created = await json('/api/v1/users', { method: 'POST', cookie: accounts.admin.cookie, expected: 201, body: { full_name: 'Verifikasi ' + name, email: name + '@verify.local', password, roles: role, ...(role.includes('MAHASISWA') ? { nim: '230555' + String(year++), admission_year: 2023 } : {}) } }); accounts[name] = { ...created.user, ...(await login(name)) } }
const a = '/api/v1/capstone'
const scopes = { admin: 'admin', coordinator: 'coordinator', tu: 'tu', lecturer1: 'lecturer', lecturer2: 'lecturer', lecturer3: 'lecturer', student1: 'student', student2: 'student', outsider: 'student', koprodi: 'koprodi' }
for (const [name, scope] of Object.entries(scopes)) { const summary = await json(a + '/dashboard', { cookie: accounts[name].cookie }); assert.equal(summary.scope, scope); assert.equal(summary.stats.projects, 0); assert.deepEqual(summary.recent_projects, []) }
const interest = await json(a + '/interests', { method: 'POST', cookie: accounts.admin.cookie, body: { name: 'Rekayasa perangkat lunak (uji)', is_active: true } })
async function upload(name, filename = 'deskripsi.pdf') { const body = new FormData(); body.append('file', new Blob(['%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'], { type: 'application/pdf' }), filename); return (await json(a + '/files', { method: 'POST', cookie: accounts[name].cookie, body, expected: 201 })).file.id }
const file = await upload('student1')
const invalidFile = new FormData(); invalidFile.append('file', new Blob(['<script>invalid upload</script>'], { type: 'application/pdf' }), 'bukan-pdf.pdf')
await request(a + '/files', { method: 'POST', cookie: accounts.student1.cookie, body: invalidFile, expected: 422 })
await request(a + '/files', { method: 'POST', cookie: accounts.tu.cookie, body: invalidFile, expected: 403 })
const members = [ { student_id: accounts.student1.id, candidate_1: accounts.lecturer1.id, candidate_2: accounts.lecturer2.id }, { student_id: accounts.student2.id, candidate_1: accounts.lecturer2.id, candidate_2: accounts.lecturer3.id } ]
const input = { title: 'Sistem capstone untuk verifikasi alur wajib', summary: 'Deskripsi untuk pengujian alur pendaftaran capstone.', interest_id: interest.id, description_file_id: file, signed_description: false, members }
let p = (await json(a + '/projects', { method: 'POST', cookie: accounts.student1.cookie, expected: 201, body: input })).project
async function project() { p = (await json(a + '/projects/' + p.id, { cookie: accounts.coordinator.cookie })).project; return p }
async function mutate(name, path, body = {}, method = 'POST', expected = 204) { const r = await request(a + '/projects/' + p.id + path, { method, cookie: accounts[name].cookie, expected, body: { version: p.version, ...body } }); if (expected === 204) await project(); return r }
await mutate('student1', '/submit', {}, 'POST', 422)
p = (await json(a + '/projects/' + p.id, { method: 'PUT', cookie: accounts.student1.cookie, body: { ...input, signed_description: true, version: p.version } })).project
await request(a + '/projects/' + p.id, { cookie: accounts.outsider.cookie, expected: 403 })
await request(a + '/files/' + file, { cookie: accounts.outsider.cookie, expected: 403 })
const memberFile = await upload('student2')
await request(a + '/projects', { method: 'POST', cookie: accounts.student2.cookie, body: { ...input, description_file_id: memberFile, signed_description: true }, expected: 409 })
await mutate('student1', '/submit')
await mutate('tu', '/finalize', {}, 'POST', 403)
await mutate('koprodi', '/finalize', {}, 'POST', 403)
await mutate('lecturer3', '/decision', { student_id: accounts.student1.id, slot: 1, kind: 'title', status: 'APPROVED' }, 'PUT', 403)
await mutate('lecturer1', '/decision', { student_id: accounts.student1.id, slot: 1, kind: 'title', status: 'APPROVED' }, 'PUT')
assert.equal(p.students.find(r => r.student_id === accounts.student1.id && r.slot === 1).confirmation_status, 'PENDING')
await mutate('coordinator', '/finalize', {}, 'POST', 422)
await mutate('student2', '/candidates', { candidate_1: accounts.lecturer3.id, candidate_2: accounts.lecturer2.id }, 'PUT')
const oldVersion = p.version
for (const r of [...p.students]) {
 await mutate('coordinator', '/assignment', { student_id: r.student_id, slot: r.slot, supervisor_id: r.candidate_id }, 'PUT')
 for (const kind of ['title', 'confirmation']) await mutate('coordinator', '/decision', { student_id: r.student_id, slot: r.slot, kind, status: 'APPROVED' }, 'PUT')
}
await request(a + '/projects/' + p.id + '/finalize', { method: 'POST', cookie: accounts.coordinator.cookie, body: { version: oldVersion }, expected: 409 })
await mutate('coordinator', '/finalize')
assert.equal(p.status, 'FINALIZED')
await request('/api/v1/users/batch-status', { method: 'PATCH', cookie: accounts.admin.cookie, body: { user_ids: [accounts.student1.id], is_active: false }, expected: 422 })
await mutate('coordinator', '/reopen', { note: 'Melengkapi penetapan pembimbing sesuai rapat lanjutan.' })
assert.equal(p.status, 'SUBMITTED')
await mutate('coordinator', '/finalize')
await mutate('student1', '/candidates', { candidate_1: accounts.lecturer1.id, candidate_2: null }, 'PUT', 409)
await mkdir(resolve(root, 'infrastructure/.run/artifacts'), { recursive: true })
for (const [path, filename, signature] of [[`/projects/${p.id}/letter`, 'penetapan.pdf', '%PDF-'], ['/projects/export?status=FINALIZED', 'judul.xlsx', 'PK']]) {
 const response = await request(a + path, { cookie: accounts.tu.cookie }); const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(bytes.subarray(0, signature.length).toString(), signature); assert.ok(response.headers.get('content-disposition')); await writeFile(resolve(root, 'infrastructure/.run/artifacts', filename), bytes)
}
const createdLog = await json(a + '/guidance', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, supervisor_id: accounts.lecturer1.id, meeting_date: '2026-11-14', topic: 'Pembahasan rancangan sistem', progress: 'Membahas kebutuhan dan rancangan sistem secara terperinci.', obstacles: 'Belum ada kendala.', next_plan: 'Menyelesaikan rancangan data.' } })
let log = (await json(a + '/guidance', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/guidance/' + createdLog.id + '/review', { method: 'PUT', cookie: accounts.lecturer2.cookie, body: { version: log.version, status: 'APPROVED' }, expected: 403 })
await request(a + '/guidance/' + createdLog.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { version: log.version, status: 'REVISION', note: 'Lengkapi rincian rancangan data.' }, expected: 204 })
log = (await json(a + '/guidance', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/guidance/' + log.id, { method: 'PUT', cookie: accounts.student1.cookie, body: { ...log, meeting_date: '2026-11-14', progress: log.progress + ' Rancangan data telah ditambahkan.' } })
log = (await json(a + '/guidance', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/guidance/' + log.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { version: log.version, status: 'APPROVED' }, expected: 204 })
const logs = (await json(a + '/guidance', { cookie: accounts.outsider.cookie })).items; assert.equal(logs.length, 0)
for (const query of ['', '?id=' + log.id]) { const r = await request(a + '/guidance/export' + query, { cookie: accounts.lecturer1.cookie }); const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); await writeFile(resolve(root, 'infrastructure/.run/artifacts/log.pdf'), bytes) }
const simak = await upload('student1', 'simak.pdf'), approval = await upload('student1', 'persetujuan.pdf')
const application = await json(a + '/proposals', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, simak_file_id: simak, approval_file_id: approval } })
let proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.admin.cookie, body: { version: proposal.version, kind: 'simak', status: 'VALID' }, expected: 403 })
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'simak', status: 'VALID' }, expected: 204 })
proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]; assert.equal(proposal.ready, false)
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'approval', status: 'REVISION', note: 'Tanda tangan pembimbing kedua belum terlihat.' }, expected: 204 })
const replacement = await upload('student1', 'persetujuan-revisi.pdf')
proposal = (await json(a + '/proposals', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/proposals', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, simak_file_id: simak, approval_file_id: replacement, version: proposal.version } })
proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]; assert.equal(proposal.simak_status, 'VALID'); assert.equal(proposal.approval_status, 'PENDING')
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'approval', status: 'VALID' }, expected: 204 })
proposal = (await json(a + '/proposals', { cookie: accounts.student1.cookie })).items[0]; assert.equal(proposal.ready, true)
await mutate('coordinator', '/reopen', { note: 'Penetapan tidak boleh diubah setelah pendaftaran UP.' }, 'POST', 409)
for (const [name, scope] of Object.entries(scopes)) {
 const summary = await json(a + '/dashboard', { cookie: accounts[name].cookie })
 assert.equal(summary.scope, scope); assert.equal(summary.stats.projects, name === 'outsider' ? 0 : 1)
 assert.equal(summary.stats.title_pending, 0); assert.equal(summary.stats.confirmation_pending, 0)
 if (name === 'outsider') { assert.equal(summary.stats.guidance, 0); assert.equal(summary.stats.proposals, 0); assert.deepEqual(summary.recent_projects, []) }
 if (name === 'lecturer1') { assert.equal(summary.stats.supervised_students, 1); assert.equal(summary.stats.guidance, 1); assert.equal(summary.stats.guidance_pending, 0) }
 if (name === 'lecturer3') assert.equal(summary.stats.guidance, 0)
 if (name === 'tu') { assert.equal(summary.stats.proposal_ready, 1); assert.equal(summary.stats.guidance, 0) }
}
await writeFile(resolve(root, 'infrastructure/.run/browser-fixtures.json'), JSON.stringify({ accounts, project: p, log, proposal }))
console.log(`PASS: ${count} permintaan HTTP; lima peran, pembimbing per mahasiswa, keputusan terpisah, finalisasi, XLSX/PDF, bimbingan, revisi berkas UP, otorisasi objek, dan konflik versi.`)
