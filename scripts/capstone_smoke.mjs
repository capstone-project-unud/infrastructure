import assert from 'node:assert/strict'
import { seedHistoricalSeminar, verifyProposalRevision } from './proposal_exam_smoke.mjs'
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
const testClients = new Map()
async function request(path, { cookie = '', method = 'GET', body, expected = 200, internal = false } = {}) {
 const clientKey = cookie || body?.identifier || 'anonymous'
 if (!testClients.has(clientKey)) testClients.set(clientKey, '198.18.0.' + (testClients.size + 1))
 const headers = { Origin: origin, Cookie: cookie, 'X-Client-IP': testClients.get(clientKey) }
 if (internal) headers['X-Service-Token'] = env.USER_INTERNAL_TOKEN
 if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
 const response = await fetch((internal ? usersURL : base) + path, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined })
 if (!(Array.isArray(expected) ? expected : [expected]).includes(response.status)) throw new Error(`${method} ${path}: expected ${expected}, got ${response.status}: ${await response.text()}`)
 count++
 return response
}
async function json(path, options) { return (await request(path, options)).json() }
const roles = { koprodi: ['DOSEN', 'KOPRODI'], admin: ['ADMIN'], coordinator: ['KOORDINATOR_TA'], tu: ['TU'], lecturer1: ['DOSEN'], lecturer2: ['DOSEN'], lecturer3: ['DOSEN'], examiner2: ['DOSEN'], student1: ['MAHASISWA'], student2: ['MAHASISWA'], outsider: ['MAHASISWA'], lecturerCoordinator: ['DOSEN', 'KOORDINATOR_TA'] }
const noLogin = new Set(['lecturer2'])
await request('/internal/bootstrap', { method: 'POST', internal: true, expected: 201, body: { full_name: 'Admin Verifikasi', email: 'admin@verify.local', password } })
const accounts = {}
async function login(name, identifier = name + '@verify.local') { const res = await request('/api/v1/auth/login', { method: 'POST', body: { identifier, password } }); const data = await res.json(); return { ...data.user, cookie: res.headers.get('set-cookie').split(';')[0], email: name + '@verify.local', password } }
accounts.admin = await login('admin')
let year = 2023
for (const [name, role] of Object.entries(roles)) {
 if (name === 'admin') continue
 const extra = role.includes('MAHASISWA') ? { nim: '230555' + String(year++), admission_year: 2023 } : name === 'lecturer3' ? { nip: '198801012020121003' } : name === 'examiner2' ? { nidn: '0012128902' } : {}
 const created = await json('/api/v1/users', { method: 'POST', cookie: accounts.admin.cookie, expected: 201, body: { full_name: 'Verifikasi ' + name, email: name + '@verify.local', password, roles: role, ...extra } })
 const loginID = name === 'student1' ? extra.nim : name === 'lecturer3' ? extra.nip : name === 'examiner2' ? extra.nidn : undefined
 accounts[name] = noLogin.has(name) ? created.user : { ...created.user, ...(await login(name, loginID)) }
}
await request('/api/v1/users', { method: 'POST', cookie: accounts.admin.cookie, expected: 422, body: { full_name: 'Tolak Koprodi', email: 'reject-koprodi@verify.local', password, roles: ['KOPRODI'] } })
const nipSearch = await json('/api/v1/users?q=198801012020121003', { cookie: accounts.admin.cookie }); assert.equal(nipSearch.items.length, 1); assert.equal(nipSearch.items[0].id, accounts.lecturer3.id)
const limitedList = await json('/api/v1/users?limit=1', { cookie: accounts.admin.cookie }); assert.equal(limitedList.items.length, 1); assert.ok(limitedList.total >= 10)
const dosenList = await json('/api/v1/users?role=DOSEN&limit=100', { cookie: accounts.admin.cookie })
assert.ok(dosenList.items.some(u => u.id === accounts.lecturer3.id)); assert.ok(!dosenList.items.some(u => u.id === accounts.lecturerCoordinator.id))
const coordList = await json('/api/v1/users?role=KOORDINATOR_TA&limit=100', { cookie: accounts.admin.cookie })
assert.ok(coordList.items.some(u => u.id === accounts.coordinator.id)); assert.ok(coordList.items.some(u => u.id === accounts.lecturerCoordinator.id)); assert.ok(!coordList.items.some(u => u.id === accounts.lecturer3.id))
await request('/api/v1/users/' + accounts.lecturer3.id, { method: 'PUT', cookie: accounts.admin.cookie, body: { full_name: accounts.lecturer3.full_name, email: accounts.lecturer3.email, roles: ['DOSEN', 'KOORDINATOR_TA'], nip: '198801012020121003' } })
assert.ok(!(await json('/api/v1/users?role=DOSEN&limit=100', { cookie: accounts.admin.cookie })).items.some(u => u.id === accounts.lecturer3.id))
assert.ok((await json('/api/v1/users?role=KOORDINATOR_TA&limit=100', { cookie: accounts.admin.cookie })).items.some(u => u.id === accounts.lecturer3.id))
await request('/api/v1/users/' + accounts.lecturer3.id, { method: 'PUT', cookie: accounts.admin.cookie, body: { full_name: accounts.lecturer3.full_name, email: accounts.lecturer3.email, roles: ['DOSEN'], nip: '198801012020121003' } })
assert.ok((await json('/api/v1/users?role=DOSEN&limit=100', { cookie: accounts.admin.cookie })).items.some(u => u.id === accounts.lecturer3.id))
const a = '/api/v1/capstone'
const scopes = { koprodi: 'koprodi', admin: 'admin', coordinator: 'coordinator', tu: 'tu', lecturer1: 'lecturer', lecturer3: 'lecturer', examiner2: 'lecturer', student1: 'student', student2: 'student', outsider: 'student', lecturerCoordinator: 'coordinator' }
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
await mutate('lecturer1', '/finalize', {}, 'POST', 403)
await mutate('lecturer3', '/decision', { student_id: accounts.student1.id, slot: 1, kind: 'title', status: 'APPROVED' }, 'PUT', 403)
await mutate('lecturer1', '/decision', { student_id: accounts.student1.id, slot: 1, kind: 'title', status: 'APPROVED' }, 'PUT')
assert.equal(p.students.find(r => r.student_id === accounts.student1.id && r.slot === 1).confirmation_status, 'PENDING')
await mutate('coordinator', '/finalize', {}, 'POST', 422)
await mutate('student2', '/candidates', { candidate_1: accounts.lecturer1.id, candidate_2: accounts.lecturer2.id }, 'PUT')
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
await request(a + '/guidance/' + createdLog.id + '/review', { method: 'PUT', cookie: accounts.lecturer3.cookie, body: { version: log.version, status: 'APPROVED' }, expected: 403 })
await request(a + '/guidance/' + createdLog.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { version: log.version, status: 'REVISION', note: 'Lengkapi rincian rancangan data.' }, expected: 204 })
log = (await json(a + '/guidance', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/guidance/' + log.id, { method: 'PUT', cookie: accounts.student1.cookie, body: { ...log, meeting_date: '2026-11-14', progress: log.progress + ' Rancangan data telah ditambahkan.' } })
log = (await json(a + '/guidance', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/guidance/' + log.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { version: log.version, status: 'APPROVED' }, expected: 204 })
const logs = (await json(a + '/guidance', { cookie: accounts.outsider.cookie })).items; assert.equal(logs.length, 0)
for (const query of ['', '?id=' + log.id]) { const r = await request(a + '/guidance/export' + query, { cookie: accounts.lecturer1.cookie }); const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); await writeFile(resolve(root, 'infrastructure/.run/artifacts/log.pdf'), bytes) }
const simak = await upload('student1', 'simak.pdf'), approval = await upload('student1', 'persetujuan.pdf')
const extraFiles = {}
for (const kind of ['english','proposal','b100','b200']) extraFiles[kind + '_file_id'] = await upload('student1', kind + '.pdf')
const application = await json(a + '/proposals', { method: 'POST', cookie: accounts.student1.cookie, body: { ...extraFiles, project_id: p.id, simak_file_id: simak, approval_file_id: approval } })
let proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.admin.cookie, body: { version: proposal.version, kind: 'simak', status: 'VALID' }, expected: 403 })
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'simak', status: 'VALID' }, expected: 204 })
proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]; assert.equal(proposal.ready, false)
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'approval', status: 'REVISION', note: 'Tanda tangan pembimbing kedua belum terlihat.' }, expected: 204 })
const replacement = await upload('student1', 'persetujuan-revisi.pdf')
proposal = (await json(a + '/proposals', { cookie: accounts.student1.cookie })).items[0]
await request(a + '/proposals', { method: 'POST', cookie: accounts.student1.cookie, body: { ...extraFiles, project_id: p.id, simak_file_id: simak, approval_file_id: replacement, version: proposal.version } })
proposal = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]; assert.equal(proposal.simak_status, 'VALID'); assert.equal(proposal.approval_status, 'PENDING')
await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: proposal.version, kind: 'approval', status: 'VALID' }, expected: 204 })
for (const kind of ['english','proposal','b100','b200']) { const row = (await json(a + '/proposals', { cookie: accounts.tu.cookie })).items[0]; await request(a + '/proposals/' + application.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { version: row.version, kind, status: 'VALID' }, expected: 204 }) }
proposal = (await json(a + '/proposals', { cookie: accounts.student1.cookie })).items[0]; assert.equal(proposal.ready, true)
await mutate('coordinator', '/reopen', { note: 'Penetapan tidak boleh diubah setelah pendaftaran UP.' }, 'POST', 409)

const schedBase = { project_id: p.id, scheduled_at: '2026-12-10T09:00:00+08:00', location: 'Ruang Sidang PSTI', examiner_1_id: accounts.lecturer3.id, examiner_2_id: accounts.examiner2.id, examiner_3_id: accounts.lecturerCoordinator.id }
await request(a + '/sempro', { method: 'POST', cookie: accounts.coordinator.cookie, body: schedBase, expected: 410 })
const b100File = await upload('student1', 'b100.pdf')
const b100Created = await json(a + '/documents', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, series: 'B-100', file_id: b100File, summary: 'Dokumen identifikasi masalah awal.' } })
let docItem = (await json(a + '/documents', { cookie: accounts.coordinator.cookie })).items[0]
await request(a + '/documents/' + b100Created.id + '/review', { method: 'PUT', cookie: accounts.examiner2.cookie, body: { version: docItem.version, status: 'APPROVED', note: '' }, expected: 403 })
await request(a + '/documents/' + b100Created.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { version: docItem.version, status: 'APPROVED', note: '' }, expected: 204 })
await request(a + '/files/' + b100File, { cookie: accounts.outsider.cookie, expected: 403 })
await request(a + '/files/' + b100File, { cookie: accounts.examiner2.cookie, expected: 200 })

await request(a + '/sempro', { method: 'POST', cookie: accounts.coordinator.cookie, body: { ...schedBase, examiner_1_id: accounts.lecturer1.id }, expected: 410 })
await request(a + '/sempro', { method: 'POST', cookie: accounts.coordinator.cookie, body: { ...schedBase, examiner_2_id: accounts.lecturer3.id }, expected: 410 })
const semproCreated = seedHistoricalSeminar(root, p, schedBase, accounts.coordinator.id)
let semproRow = (await json(a + '/sempro', { cookie: accounts.coordinator.cookie })).items[0].seminar
await request(a + '/sempro/' + semproCreated.id + '/decision', { method: 'POST', cookie: accounts.coordinator.cookie, body: { version: semproRow.version, status: 'APPROVED', note: '' }, expected: 422 })

const ikCodes = ['IK-1a', 'IK-1b', 'IK-1c', 'IK-2a', 'IK-2b', 'IK-2c', 'IK-3a', 'IK-3b', 'IK-4a', 'IK-4b', 'IK-4c', 'IK-5a', 'IK-5b', 'IK-6a', 'IK-6b', 'IK-6c']
const rubricScores = Object.fromEntries(ikCodes.map(c => [c, 85]))
await request(a + '/sempro/' + semproCreated.id + '/evaluate', { method: 'PUT', cookie: accounts.coordinator.cookie, body: { student_id: accounts.student1.id, scores: rubricScores, recommendation: 'APPROVED', notes: '' }, expected: 403 })
for (const ex of ['lecturer3', 'examiner2', 'lecturerCoordinator']) {
 for (const st of ['student1', 'student2']) {
  const scored = await json(a + '/sempro/' + semproCreated.id + '/evaluate', { method: 'PUT', cookie: accounts[ex].cookie, body: { student_id: accounts[st].id, scores: rubricScores, recommendation: 'APPROVED', notes: '' } })
  assert.equal(scored.total_score, 85); assert.equal(scored.grade_label, 'ISTIMEWA')
 }
}
semproRow = (await json(a + '/sempro', { cookie: accounts.coordinator.cookie })).items[0].seminar
await request(a + '/sempro/' + semproCreated.id + '/decision', { method: 'POST', cookie: accounts.coordinator.cookie, body: { version: semproRow.version, status: 'REVISION', note: 'Lengkapi skenario pengujian pada bab metode.' }, expected: 204 })
semproRow = (await json(a + '/sempro', { cookie: accounts.student1.cookie })).items[0].seminar
const semproRevFile = await upload('student1', 'sempro-revisi.pdf')
await request(a + '/sempro/' + semproCreated.id + '/revision', { method: 'POST', cookie: accounts.student1.cookie, body: { revision_file_id: semproRevFile, revision_note: 'Skenario pengujian telah ditambahkan pada bagian metode.', version: semproRow.version }, expected: 204 })
semproRow = (await json(a + '/sempro', { cookie: accounts.coordinator.cookie })).items[0].seminar
await request(a + '/sempro/' + semproCreated.id + '/decision', { method: 'POST', cookie: accounts.coordinator.cookie, body: { version: semproRow.version, status: 'APPROVED', note: 'Disahkan untuk dilanjutkan ke implementasi.' }, expected: 204 })
await request(a + '/sempro/' + semproCreated.id + '/evaluate', { method: 'PUT', cookie: accounts.examiner2.cookie, body: { student_id: accounts.student1.id, scores: rubricScores, recommendation: 'APPROVED', notes: '' }, expected: 409 })
{ const r = await request(a + '/sempro/' + semproCreated.id + '/report', { cookie: accounts.tu.cookie }); const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); await writeFile(resolve(root, 'infrastructure/.run/artifacts/berita-acara-sempro.pdf'), bytes) }

for (const [name, scope] of Object.entries(scopes)) {
 const summary = await json(a + '/dashboard', { cookie: accounts[name].cookie })
 assert.equal(summary.scope, scope); assert.equal(summary.stats.projects, name === 'outsider' ? 0 : 1)
 assert.equal(summary.stats.title_pending, 0); assert.equal(summary.stats.confirmation_pending, 0)
 if (name === 'outsider') { assert.equal(summary.stats.guidance, 0); assert.equal(summary.stats.proposals, 0); assert.equal(summary.stats.sempro_approved, 0); assert.deepEqual(summary.recent_projects, []) }
 if (name === 'student1') { assert.equal(summary.stats.guidance_approved, 1); assert.equal(summary.stats.documents_approved, 1); assert.equal(summary.stats.sempro_approved, 1) }
 if (name === 'lecturer1') { assert.equal(summary.stats.supervised_students, 2); assert.equal(summary.stats.guidance, 1); assert.equal(summary.stats.guidance_approved, 1); assert.equal(summary.stats.guidance_pending, 0); assert.equal(summary.stats.sempro_approved, 1) }
 if (name === 'examiner2') { assert.equal(summary.stats.sempro_approved, 1) }
 if (name === 'lecturer3') { assert.equal(summary.stats.guidance, 0); assert.equal(summary.stats.sempro_approved, 1) }
 if (name === 'tu') { assert.equal(summary.stats.proposal_ready, 1); assert.equal(summary.stats.simak_valid, 1); assert.equal(summary.stats.approval_valid, 1); assert.equal(summary.stats.guidance, 0); assert.equal(summary.stats.sempro_approved, 1) }
}
const userStats = await json('/api/v1/users/stats', { cookie: accounts.admin.cookie })
assert.ok(userStats.coordinators >= 2 && userStats.students === 3 && Array.isArray(userStats.cohorts) && userStats.cohorts.some(c => c.year === 2023 && c.total === 3))

// Verifikasi Dashboard Mahasiswa menampilkan Kelompok, Ketua, Tugas Anggota, dan Pembimbing 1 & 2
const studentDash = await json(a + '/dashboard', { cookie: accounts.student1.cookie })
assert.ok(studentDash.student_group && studentDash.student_group.members.length === 2, 'Dashboard mahasiswa wajib memuat daftar anggota kelompok')
assert.equal(studentDash.student_group.leader_id, accounts.student1.id)
assert.ok(studentDash.student_group.members.some(m => m.is_leader && m.responsibility.length > 0))
assert.equal(studentDash.student_group.advisors.filter(ad => ad.student_id === accounts.student1.id && ad.supervisor_id).length, 2, 'Pembimbing 1 dan 2 wajib tampil pada kelompok mahasiswa')

// SOP-004: Data Master Akademik (Periode, Jenis Dokumen lengkap, Syarat Tahap, Rubrik PA I & PA II)
const periodsRes = await json(a + '/master/periods', { cookie: accounts.admin.cookie }); assert.ok(periodsRes.items.length >= 2)
const docTypesRes = await json(a + '/master/document-types', { cookie: accounts.admin.cookie }); assert.ok(docTypesRes.items.length >= 16)
const stageReqRes = await json(a + '/master/stage-requirements', { cookie: accounts.admin.cookie }); assert.equal(stageReqRes.items.length, 5)
const rubricsRes = await json(a + '/master/rubrics', { cookie: accounts.admin.cookie }); assert.equal(rubricsRes.items.length, 32)
const periodExtra = await json(a + '/master/periods', { method: 'POST', cookie: accounts.admin.cookie, body: { code: '2027-GENAP', name: 'TA 2026/2027 Genap', semester: 'GENAP', start_date: '2027-02-01', end_date: '2027-07-31', group_open: true, topic_open: true, sempro_open: true, exam_open: true, is_active: false } })

// SOP-005 & SOP-006: Bentuk Kelompok terlebih dahulu -> Ajukan Usulan Topik dari Kelompok + SOP-007/008 Seminar Topik
const grpCreated = await json(a + '/groups', { method: 'POST', cookie: accounts.outsider.cookie, expected: 201, body: { academic_period_id: periodExtra.id, interest_id: interest.id, working_title: 'Kelompok Uji Langkah Pertama', initial_description: 'Pembentukan kelompok terlebih dahulu sebelum pengajuan topik sesuai SOP-005.', finalize: true, members: [{ student_id: accounts.outsider.id, is_leader: true, responsibility: 'Ketua & Perancang Sistem' }, { student_id: accounts.student2.id, is_leader: false, responsibility: 'Pengembang Aplikasi & Pengujian' }] } })
assert.equal(grpCreated.group.status, 'READY')
const groupTopicFile = await upload('outsider', 'usulan-kelompok.pdf')
const pFromGroup = (await json(a + '/groups/' + grpCreated.group.id + '/topic', { method: 'POST', cookie: accounts.outsider.cookie, expected: 201, body: { description_file_id: groupTopicFile, signed_description: true, members: [{ student_id: accounts.outsider.id, candidate_1: accounts.lecturer1.id, candidate_2: accounts.lecturerCoordinator.id }, { student_id: accounts.student2.id, candidate_1: accounts.lecturer1.id, candidate_2: accounts.lecturerCoordinator.id }] } })).project
assert.equal(pFromGroup.group_id, grpCreated.group.id)
await request(a + '/projects/' + pFromGroup.id + '/submit', { method: 'POST', cookie: accounts.outsider.cookie, expected: 204, body: { version: pFromGroup.version } })
const pGroupReload = (await json(a + '/projects/' + pFromGroup.id, { cookie: accounts.tu.cookie })).project
await request(a + '/projects/' + pFromGroup.id + '/verify-topic', { method: 'POST', cookie: accounts.tu.cookie, expected: 204, body: { version: pGroupReload.version, status: 'VALID', note: 'Berkas lengkap.' } })
const tsReg = await json(a + '/topic-seminars', { method: 'POST', cookie: accounts.outsider.cookie, expected: 201, body: { project_id: pFromGroup.id } })
let tsRow = (await json(a + '/topic-seminars?project_id=' + pFromGroup.id, { cookie: accounts.coordinator.cookie })).items[0]
await request(a + '/topic-seminars/' + tsReg.id + '/schedule', { method: 'PUT', cookie: accounts.coordinator.cookie, expected: 204, body: { scheduled_at: '2027-02-15T10:00:00+08:00', location: 'Ruang Bidang Minat', panelist_1_id: accounts.lecturer3.id, panelist_2_id: accounts.examiner2.id, version: tsRow.version } })
tsRow = (await json(a + '/topic-seminars?project_id=' + pFromGroup.id, { cookie: accounts.lecturer3.cookie })).items[0]
await request(a + '/topic-seminars/' + tsReg.id + '/evaluate', { method: 'PUT', cookie: accounts.lecturer3.cookie, expected: 204, body: { feasibility_notes: 'Topik memenuhi kompleksitas computing.', version: tsRow.version } })
tsRow = (await json(a + '/topic-seminars?project_id=' + pFromGroup.id, { cookie: accounts.coordinator.cookie })).items[0]
await request(a + '/topic-seminars/' + tsReg.id + '/decision', { method: 'POST', cookie: accounts.coordinator.cookie, expected: 204, body: { status: 'LAYAK', decision_note: 'Disetujui lanjut penetapan pembimbing.', version: tsRow.version } })

// SOP-009 Surat Tugas Pembimbing & SOP-011 Dokumen Lengkap + Multi-versi pada proyek p
const stFile = await upload('coordinator', 'surat-tugas.pdf')
await mutate('coordinator', '/assignment-letter', { file_id: stFile, number: 'ST-001/UN14/2026', issued_date: '2026-11-01' }, 'PUT')
const b100v2File = await upload('student1', 'b100-v2.pdf')
docItem = (await json(a + '/documents?series=B-100&project_id=' + p.id, { cookie: accounts.student1.cookie })).items[0]
await json(a + '/documents', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, doc_type_code: 'B-100', file_id: b100v2File, summary: 'Versi revisi pasca sempro.', version: docItem.version } })
docItem = (await json(a + '/documents?series=B-100&project_id=' + p.id, { cookie: accounts.coordinator.cookie })).items[0]
assert.equal(docItem.versions.length, 2, 'Riwayat versi dokumen harus mencatat versi ke-1 dan ke-2')
await request(a + '/documents/' + docItem.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, expected: 204, body: { version: docItem.version, status: 'APPROVED', note: '' } })
for (const code of ['B-200', 'B-300', 'B-400', 'PROPOSAL_USULAN', 'LAPORAN_AKHIR', 'BUKTI_PLAGIARISME', 'PERSETUJUAN_UA', 'EXPO_POSTER']) {
 const fUp = await upload('student1', `${code.toLowerCase()}.pdf`)
 const dCreated = await json(a + '/documents', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, doc_type_code: code, file_id: fUp, summary: `Dokumen ${code}` } })
 const dLoaded = (await json(a + '/documents?project_id=' + p.id + '&doc_type_code=' + code, { cookie: accounts.coordinator.cookie })).items[0]
 await request(a + '/documents/' + dCreated.id + '/review', { method: 'PUT', cookie: accounts.coordinator.cookie, expected: 204, body: { version: dLoaded.version, status: 'APPROVED', note: '' } })
}
await request(a + '/projects/' + p.id + '/sempro-approval', { method: 'POST', cookie: accounts.lecturer1.cookie, expected: 204, body: { status: 'APPROVED', note: 'Pembimbing menyetujui.' } })

// SOP-014 Revisi terstruktur & pengesahan revisi Sempro
const revItemRes = await json(a + '/revisions', { method: 'POST', cookie: accounts.examiner2.cookie, expected: 201, body: { stage: 'SEMPRO', seminar_id: semproCreated.id, project_id: p.id, note: 'Tambahkan blok diagram komunikasi pada Bab III.' } })
const revLoaded1 = (await json(a + '/sempro?project_id=' + p.id, { cookie: accounts.student1.cookie })).items[0].seminar.revision_items[0]
await request(a + '/revisions/' + revItemRes.id + '/respond', { method: 'PUT', cookie: accounts.student1.cookie, expected: 204, body: { student_response: 'Blok diagram sudah dilengkapi pada B-200 dan proposal.', version: revLoaded1.version } })
const revLoaded2 = (await json(a + '/sempro?project_id=' + p.id, { cookie: accounts.examiner2.cookie })).items[0].seminar.revision_items[0]
await request(a + '/revisions/' + revItemRes.id + '/review', { method: 'PUT', cookie: accounts.examiner2.cookie, expected: 204, body: { status: 'APPROVED', reviewer_note: 'Sesuai.', version: revLoaded2.version } })
const semproRevSigned = await upload('coordinator', 'pengesahan-revisi-sempro.pdf')
semproRow = (await json(a + '/sempro?project_id=' + p.id, { cookie: accounts.coordinator.cookie })).items[0].seminar
await request(a + '/sempro/' + semproCreated.id + '/revision-approval', { method: 'POST', cookie: accounts.coordinator.cookie, expected: 204, body: { file_id: semproRevSigned, version: semproRow.version } })

// SOP-015..017: Ujian Akhir (11 Syarat, Penjadwalan, PA II 16-IK Rubric, Lulus + Berita Acara PDF + Verifikasi Deaktivasi)
for (const st of ['student1', 'student2']) {
 const f1 = await upload(st, 'transkrip.pdf'), f2 = await upload(st, 'spp.pdf'), f3 = await upload(st, 'ijazah.pdf'), f4 = await upload(st, 'foto.pdf'), f5 = await upload(st, 'pa.pdf'), f6 = await upload(st, 'turnitin.pdf')
 const appRes = await json(a + '/final-exam/applications', { method: 'POST', cookie: accounts[st].cookie, body: { project_id: p.id, sks_completed: 144, min_grade_ok: true, transcript_file_id: f1, spp_file_id: f2, biodata_summary: 'Biodata lengkap Ujian Akhir', ijazah_file_id: f3, photo_file_id: f4, pa_letter_file_id: f5, plagiarism_pct: 8.5, plagiarism_file_id: f6 } })
 const appRow = (await json(a + '/final-exam?project_id=' + p.id, { cookie: accounts.tu.cookie })).items[0].applications.find(ap => ap.id === appRes.id)
 await request(a + '/final-exam/applications/' + appRes.id + '/tu-review', { method: 'PUT', cookie: accounts.tu.cookie, expected: 204, body: { status: 'VALID', note: '11 berkas administrasi valid.', version: appRow.version } })
 const appRow2 = (await json(a + '/final-exam?project_id=' + p.id, { cookie: accounts.lecturer1.cookie })).items[0].applications.find(ap => ap.id === appRes.id)
 await request(a + '/final-exam/applications/' + appRes.id + '/advisor-review', { method: 'PUT', cookie: accounts.lecturer1.cookie, expected: 204, body: { approved: true, note: 'Pembimbing 1 menyetujui maju sidang.', version: appRow2.version } })
}
const feCreated = await json(a + '/final-exam/schedule', { method: 'POST', cookie: accounts.coordinator.cookie, body: { project_id: p.id, scheduled_at: '2026-12-20T09:00:00+08:00', location: 'Ruang Sidang Utama PSTI', examiner_1_id: accounts.lecturer3.id, examiner_2_id: accounts.examiner2.id, examiner_3_id: accounts.lecturerCoordinator.id } })
const pa2Scores = Object.fromEntries(ikCodes.map(c => [c, 88]))
for (const ex of ['lecturer3', 'examiner2', 'lecturerCoordinator']) {
 for (const st of ['student1', 'student2']) {
  await json(a + '/final-exam/' + feCreated.id + '/evaluate', { method: 'PUT', cookie: accounts[ex].cookie, body: { student_id: accounts[st].id, scores: pa2Scores, recommendation: 'PASSED', notes: '' } })
 }
}
const feRow = (await json(a + '/final-exam?project_id=' + p.id, { cookie: accounts.coordinator.cookie })).items[0].exam
await request(a + '/final-exam/' + feCreated.id + '/decision', { method: 'POST', cookie: accounts.coordinator.cookie, expected: 204, body: { status: 'PASSED', note: 'Lulus Ujian Akhir tanpa mengulang.', version: feRow.version } })
{ const r = await request(a + '/final-exam/' + feCreated.id + '/report', { cookie: accounts.tu.cookie }); const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); await writeFile(resolve(root, 'infrastructure/.run/artifacts/berita-acara-ujian-akhir.pdf'), bytes) }
{ const rAtt = await request(a + '/final-exam/' + feCreated.id + '/report?kind=attendance', { cookie: accounts.tu.cookie }); const bAtt = Buffer.from(await rAtt.arrayBuffer()); assert.equal(bAtt.subarray(0, 5).toString(), '%PDF-'); await writeFile(resolve(root, 'infrastructure/.run/artifacts/presensi-ujian-akhir.pdf'), bAtt) }

// Verifikasi deaktivasi massal mahasiswa: ditolak (422) bagi belum lulus & berhasil (200) bagi lulus Ujian Akhir
await request('/api/v1/users/batch-status', { method: 'PATCH', cookie: accounts.admin.cookie, body: { user_ids: [accounts.outsider.id], is_active: false }, expected: 422 })
const deactivatedRes = await json('/api/v1/users/batch-status', { method: 'PATCH', cookie: accounts.admin.cookie, body: { user_ids: [accounts.student2.id], is_active: false }, expected: 200 })
assert.equal(deactivatedRes.updated_count, 1)

// SOP-018: Capstone Expo & Publikasi Karya
const expoPoster = await upload('student1', 'poster-60x160.pdf')
const expoCreated = await json(a + '/expo', { method: 'POST', cookie: accounts.student1.cookie, body: { project_id: p.id, title: 'Showcase Capstone IoT Teruji', category: 'SOFTWARE', abstract_id: 'Abstrak publikasi showcase karya Capstone Project Program Studi Teknologi Informasi Universitas Udayana.', poster_file_id: expoPoster, video_url: 'https://youtu.be/capstone-demo', repo_url: 'https://github.com/psti-unud/capstone-verify', publication_consent: true, submit: true } })
const expoLoaded = (await json(a + '/expo', { cookie: accounts.admin.cookie })).items[0]
await request(a + '/expo/' + expoCreated.id + '/review', { method: 'PUT', cookie: accounts.admin.cookie, expected: 204, body: { status: 'PUBLISHED', note: 'Disetujui terbit di Galeri Expo.', version: expoLoaded.version } })
const gallery = await json(a + '/expo?published=true', { cookie: accounts.outsider.cookie })
assert.equal(gallery.items.length, 1)
const pubExpo = await json(a + '/public/expo')
assert.equal(pubExpo.items.length, 1); assert.equal(pubExpo.items[0].id, expoCreated.id)
{ const rPub = await request(a + '/public/expo/' + expoCreated.id + '/poster'); assert.equal(Buffer.from(await rPub.arrayBuffer()).subarray(0, 5).toString(), '%PDF-') }

// SOP-019: Asisten Pedoman RAG (Terjawab dengan rujukan & penolakan di luar konteks + kelola sumber)
const ragOk = await json(a + '/assistant/chat', { method: 'POST', cookie: accounts.student1.cookie, body: { question: 'Berapa minimal SKS lulus dan similarity Turnitin untuk Ujian Akhir?' } })
assert.equal(ragOk.message.status, 'ANSWERED'); assert.ok(ragOk.message.citations.length >= 1)
const ragOutOfScope = await json(a + '/assistant/chat', { method: 'POST', cookie: accounts.student1.cookie, body: { session_id: ragOk.session_id, question: 'Bagaimana cara memasak rendang padang?' } })
assert.equal(ragOutOfScope.message.status, 'INSUFFICIENT_CONTEXT')
const kbNew = await json(a + '/assistant/sources', { method: 'POST', cookie: accounts.admin.cookie, expected: 201, body: { code: 'SOP-TAMBAHAN', title: 'Addendum Pedoman Uji Verifikasi', version_label: 'v2026.9', effective_date: '2026-11-16', approval_proof: 'SK Koordinator', raw_text: '# Jadwal Expo Tahunan\nCapstone Expo diselenggarakan setelah mahasiswa menuntaskan seluruh revisi Ujian Akhir dan mengunggah poster 60x160 cm.\n\n# Aturan Arsip\nSeluruh laporan akhir diserahkan dalam bentuk digital dan cetak sesuai panduan.' } })
await json(a + '/assistant/sources/' + kbNew.id + '/index', { method: 'POST', cookie: accounts.admin.cookie, body: {} })
await json(a + '/assistant/sources/' + kbNew.id + '/test', { method: 'POST', cookie: accounts.admin.cookie, body: { query: 'Expo' } })
await request(a + '/assistant/sources/' + kbNew.id + '/activate', { method: 'POST', cookie: accounts.admin.cookie, expected: 204, body: {} })

// SOP-020: Monitoring & Pelaporan 3 Jenis Laporan + XLSX/PDF Export
for (const rType of ['progress', 'guidance', 'outcomes']) {
 const rep = await json(a + '/monitoring/report?type=' + rType, { cookie: accounts.tu.cookie })
 assert.equal(rep.empty, false); assert.ok(rep.rows.length >= 1)
 const xRes = await request(a + '/monitoring/export?format=xlsx&type=' + rType, { cookie: accounts.tu.cookie })
 assert.equal(Buffer.from(await xRes.arrayBuffer()).subarray(0, 2).toString(), 'PK')
 const pRes = await request(a + '/monitoring/export?format=pdf&type=' + rType, { cookie: accounts.tu.cookie })
 assert.equal(Buffer.from(await pRes.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
}

await verifyProposalRevision({ root, accounts, request, json, upload, password, login })
await writeFile(resolve(root, 'infrastructure/.run/browser-fixtures.json'), JSON.stringify({ accounts, project: p, log, proposal, sempro: semproRow }))
console.log(`PASS: ${count} permintaan HTTP; SOP-001 s.d. SOP-020 lengkap (Data Master, Kelompok terlebih dahulu, Seminar Topik, Surat Tugas, B-100..B-400 & semua jenis dokumen multi-versi, Sempro + Revisi, Ujian Akhir 11 syarat & PA II, Expo, RAG Assistant, Monitoring & Pelaporan, serta verifikasi deaktivasi kelulusan).`)
