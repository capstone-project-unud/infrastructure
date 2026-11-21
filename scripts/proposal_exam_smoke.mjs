import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export function seedHistoricalSeminar(root, project, schedule, actorId) {
 const id = randomUUID()
 const quote = value => "'" + value.replaceAll("'", "''") + "'"
 const panel = [1, 2, 3].flatMap(n => [schedule['examiner_' + n + '_id'], 'Penilai historis ' + n])
 const values = [id, project.id, schedule.scheduled_at, schedule.location, ...panel, actorId].map(quote)
 // Historical rows exercise the retained revision APIs; the scheduling endpoint is retired.
 execFileSync('docker', ['compose', '-p', 'capstone-verify', '-f', resolve(root, 'infrastructure/compose.verify.yaml'), 'exec', '-T', 'postgres', 'psql', '-U', 'verify', '-d', 'verify', '-v', 'ON_ERROR_STOP=1'], {
  input: `INSERT INTO capstone_service.proposal_seminars(id,project_id,scheduled_at,location,examiner_1_id,examiner_1_name,examiner_2_id,examiner_2_name,examiner_3_id,examiner_3_name,scheduled_by) VALUES(${values.join(',')});`, stdio: ['pipe', 'pipe', 'pipe'],
 })
 return { id }
}

export async function verifyProposalRevision({ root, accounts, request, json, upload, password, login }) {
 const a = '/api/v1/capstone'
 for (const [index, name] of ['proposalStudent1', 'proposalStudent2'].entries()) {
  const res = await json('/api/v1/users', { method: 'POST', cookie: accounts.admin.cookie, expected: 201, body: { full_name: 'Mahasiswa proposal ' + (index + 1), email: name + '@verify.local', password, roles: ['MAHASISWA'], nim: '00190000' + index, admission_year: 2026 } })
  accounts[name] = { ...res.user, ...(await login(name)) }
 }
 accounts.lecturer2 = { ...accounts.lecturer2, ...(await login('lecturer2')) }
 const interest = await json(a + '/interests', { method: 'POST', cookie: accounts.admin.cookie, body: { name: 'Bidang khusus proposal revisi', is_active: true } })
 const description = await upload('proposalStudent1', 'deskripsi-pengesahan.pdf')
 const members = [
  { student_id: accounts.proposalStudent1.id, candidate_1: accounts.lecturer1.id, candidate_2: accounts.lecturer2.id },
  { student_id: accounts.proposalStudent2.id, candidate_1: accounts.lecturer2.id, candidate_2: accounts.lecturer3.id },
 ]
 let p = (await json(a + '/projects', { method: 'POST', cookie: accounts.proposalStudent1.cookie, expected: 201, body: { title: 'Judul kelompok dengan pembimbing berbeda per mahasiswa', summary: 'Pengujian revisi pendaftaran dan penilaian proposal individu.', interest_id: interest.id, description_file_id: description, signed_description: true, members } })).project
 async function projectMutation(path, body = {}, method = 'POST', who = 'coordinator') {
  await request(a + '/projects/' + p.id + path, { method, cookie: accounts[who].cookie, body: { version: p.version, ...body }, expected: 204 })
  p = (await json(a + '/projects/' + p.id, { cookie: accounts.coordinator.cookie })).project
 }
 await projectMutation('/submit', {}, 'POST', 'proposalStudent1')
 for (const m of [...p.students]) {
  await projectMutation('/assignment', { student_id: m.student_id, slot: m.slot, supervisor_id: m.candidate_id }, 'PUT')
  for (const kind of ['title', 'confirmation']) await projectMutation('/decision', { student_id: m.student_id, slot: m.slot, kind, status: 'APPROVED' }, 'PUT')
 }
 await projectMutation('/finalize')
 const kinds = ['simak', 'approval', 'english', 'proposal', 'b100', 'b200']
 const applications = {}
 const forms = {}
 async function ownApplication(name) { return (await json(a + '/proposals', { cookie: accounts[name].cookie })).items[0] }
 for (const name of ['proposalStudent1', 'proposalStudent2']) {
  const form = { project_id: p.id }
  for (const kind of kinds) form[kind + '_file_id'] = await upload(name, kind + '.pdf')
  if (name === 'proposalStudent1') {
   const { b200_file_id, ...missing } = form
   await request(a + '/proposals', { method: 'POST', cookie: accounts[name].cookie, body: missing, expected: 422 })
   await request(a + '/proposals', { method: 'POST', cookie: accounts.outsider.cookie, body: form, expected: 422 })
   await request(a + '/proposals', { method: 'POST', cookie: accounts[name].cookie, body: { ...form, b200_file_id: form.b100_file_id }, expected: 422 })
   const foreign = await upload('student1', 'berkas-milik-mahasiswa-lain.pdf')
   await request(a + '/proposals', { method: 'POST', cookie: accounts[name].cookie, body: { ...form, b100_file_id: foreign }, expected: 403 })
  }
  applications[name] = await json(a + '/proposals', { method: 'POST', cookie: accounts[name].cookie, body: form })
  forms[name] = form
 }
 const first = applications.proposalStudent1.id
 const schedule = { application_id: first, scheduled_at: '2025-09-10T09:15:00+08:00', location: 'Ruang sesuai jadwal eksternal', examiner_1_id: accounts.lecturer3.id, examiner_2_id: accounts.examiner2.id, examiner_3_id: accounts.lecturerCoordinator.id }
 await request(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent1.cookie, body: schedule, expected: 422 })
 for (const name of ['proposalStudent1', 'proposalStudent2']) {
  for (const kind of kinds) {
   const current = await ownApplication(name)
   await request(a + '/proposals/' + current.id + '/review', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { kind, status: 'VALID', version: current.version }, expected: 403 })
   await request(a + '/proposals/' + current.id + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { kind, status: kind === 'english' && name === 'proposalStudent1' ? 'REVISION' : 'VALID', note: 'Periksa sertifikat bahasa Inggris.', version: current.version }, expected: 204 })
  }
 }
 let current = await ownApplication('proposalStudent1')
 assert.equal(current.ready, false)
 assert.equal(current.documents.find(d => d.kind === 'english').status, 'REVISION')
 const replacement = await upload('proposalStudent1', 'sertifikat-revisi.pdf')
 forms.proposalStudent1.english_file_id = replacement
 await request(a + '/proposals', { method: 'POST', cookie: accounts.proposalStudent1.cookie, body: { ...forms.proposalStudent1, version: current.version } })
 current = await ownApplication('proposalStudent1')
 assert.equal(current.documents.filter(d => d.status === 'VALID').length, 5)
 assert.equal(current.documents.find(d => d.kind === 'english').status, 'PENDING')
 await request(a + '/proposals/' + first + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { kind: 'english', status: 'VALID', version: current.version - 1 }, expected: 409 })
 await request(a + '/proposals/' + first + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { kind: 'english', status: 'VALID', version: current.version }, expected: 204 })
 assert.equal((await ownApplication('proposalStudent1')).ready, true)
 assert.equal((await json(a + '/proposals?interest_id=' + interest.id + '&validity=ready', { cookie: accounts.lecturer1.cookie })).items.length, 2)
 assert.equal((await json(a + '/proposals?interest_id=' + interest.id + '&validity=revision', { cookie: accounts.tu.cookie })).items.length, 0)
 const filtered = await json(a + '/proposals?interest_id=' + interest.id, { cookie: accounts.tu.cookie })
 assert.notEqual(filtered.items[0].supervisor_1_name, filtered.items[1].supervisor_1_name)
 await request(a + '/files/' + replacement, { cookie: accounts.outsider.cookie, expected: 403 })
 for (const role of ['lecturer1', 'tu', 'coordinator', 'koprodi']) {
  await request(a + '/files/' + replacement, { cookie: accounts[role].cookie })
  const res = await request(a + '/proposals/export?interest_id=' + interest.id + '&validity=ready', { cookie: accounts[role].cookie })
  const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(bytes.subarray(0, 2).toString(), 'PK')
  const XLSX = await import(pathToFileURL(resolve(root, 'frontend/node_modules/xlsx/xlsx.mjs')).href)
  const workbook = XLSX.read(bytes, { type: 'buffer' }); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
  assert.deepEqual(rows[0].slice(0, 5), ['NIM', 'Nama', 'Judul', 'P1', 'P2']); assert.equal(rows.length, 3); assert.ok(rows.some(r => r[0] === '001900000'))
  await writeFile(resolve(root, 'infrastructure/.run/artifacts/proposal-registration.xlsx'), bytes)
 }
 await request(a + '/proposals/export', { cookie: accounts.proposalStudent1.cookie, expected: 403 })
 for (const role of ['coordinator', 'tu', 'koprodi']) await request(a + '/proposal-exams', { method: 'POST', cookie: accounts[role].cookie, body: schedule, expected: 403 })
 await request(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent2.cookie, body: schedule, expected: 404 })
 await request(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent1.cookie, body: { ...schedule, examiner_1_id: accounts.lecturer1.id }, expected: 422 })
 const ex1 = await json(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent1.cookie, body: schedule })
 const secondSchedule = { ...schedule, application_id: applications.proposalStudent2.id, scheduled_at: '2025-09-11T13:45:00+08:00', examiner_1_id: accounts.lecturer1.id }
 const ex2 = await json(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent2.cookie, body: secondSchedule })
 async function exam(name, id) { return (await json(a + '/proposal-exams', { cookie: accounts[name].cookie })).items.find(e => e.id === id) }
 let firstExam = await exam('proposalStudent1', ex1.id)
 const secondExam = await exam('proposalStudent2', ex2.id)
 assert.notEqual(firstExam.scheduled_at, secondExam.scheduled_at)
 assert.notEqual(firstExam.panel[0].id, secondExam.panel[0].id)
 assert.equal((await json(a + '/proposal-exams', { cookie: accounts.outsider.cookie })).items.length, 0)
 await request(a + '/proposal-exams/' + ex1.id + '/report?kind=minutes', { cookie: accounts.proposalStudent2.cookie, expected: 403 })
 const codes = ['IK-1a', 'IK-1b', 'IK-1c', 'IK-2a', 'IK-2b', 'IK-2c', 'IK-3a', 'IK-3b', 'IK-4a', 'IK-4b', 'IK-4c', 'IK-5a', 'IK-5b', 'IK-6a', 'IK-6b', 'IK-6c']
 const score = { scores: Object.fromEntries(codes.map(k => [k, 80])), recommendation: 'APPROVED', notes: '', version: 0, confirm_signature: true }
 await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: score, expected: 422 })
 const policy = { name: 'Aturan sintetis untuk pengujian saja', indicator_weights: Object.fromEntries(codes.map(k => [k, 6.25])), panel_weights: { SUPERVISOR_1: 30, SUPERVISOR_2: 20, EXAMINER_1: 20, EXAMINER_2: 20, EXAMINER_3: 10 }, letter_bands: [{ minimum: 80, letter: 'A' }, { minimum: 65, letter: 'B' }, { minimum: 0, letter: 'C' }] }
 await request(a + '/proposal-grading-policy', { method: 'POST', cookie: accounts.koprodi.cookie, body: policy, expected: 403 })
 await request(a + '/proposal-grading-policy', { method: 'POST', cookie: accounts.coordinator.cookie, body: { ...policy, panel_weights: { ...policy.panel_weights, SUPERVISOR_1: 20 } }, expected: 422 })
 const published = await json(a + '/proposal-grading-policy', { method: 'POST', cookie: accounts.coordinator.cookie, body: policy })

 const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) } return (crc ^ 0xffffffff) >>> 0 }
 const chunk = (type, data) => { const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const payload = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(payload)); return Buffer.concat([length, payload, crc]) }
 const width = 256, height = 80, raw = Buffer.alloc((width * 4 + 1) * height)
 for (let x = 8; x < width - 8; x++) { const y = Math.round(40 + 15 * Math.sin(x / 11)); for (let d = -1; d <= 1; d++) raw[(y + d) * (width * 4 + 1) + 1 + x * 4 + 3] = 255 }
 const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6
 const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])

 async function signature(role, version = 0, data = png) { const form = new FormData(); form.append('file', new Blob([data], { type: 'image/png' }), 'signature.png'); form.append('version', String(version)); return request(a + '/signature', { method: 'POST', cookie: accounts[role].cookie, body: form, expected: role === 'proposalStudent1' ? 403 : data === png ? 200 : 422 }) }
 await signature('proposalStudent1')
 await signature('lecturer1', 0, Buffer.from('<svg>invalid</svg>'))
 await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: score, expected: 422 })
 for (const role of ['lecturer1', 'lecturer2', 'lecturer3', 'examiner2', 'lecturerCoordinator']) await signature(role)
 await request(a + '/signature/preview', { cookie: accounts.proposalStudent1.cookie, expected: 403 })
 await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts.koprodi.cookie, body: score, expected: 403 })
 await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { ...score, confirm_signature: false }, expected: 422 })
 await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts.lecturer1.cookie, body: { ...score, scores: { ...score.scores, unknown: 50 } }, expected: 422 })
 await request(a + '/proposal-exams/' + ex1.id + '/attendance', { method: 'POST', cookie: accounts.koprodi.cookie, body: { confirm_signature: true }, expected: 403 })
 await request(a + '/proposal-exams/' + ex1.id + '/attendance', { method: 'POST', cookie: accounts.lecturer1.cookie, body: { confirm_signature: true }, expected: 204 })
 await request(a + '/proposal-exams', { method: 'POST', cookie: accounts.proposalStudent1.cookie, body: { ...schedule, scheduled_at: '2025-09-10T11:00:00+08:00', version: firstExam.version }, expected: 409 })
 await request(a + '/proposals/' + first + '/review', { method: 'PUT', cookie: accounts.tu.cookie, body: { kind: 'simak', status: 'REVISION', note: 'Tidak boleh mengubah setelah ujian tercatat.', version: (await ownApplication('proposalStudent1')).version }, expected: 409 })
 for (const [index, role] of ['lecturer1', 'lecturer2', 'lecturer3', 'examiner2', 'lecturerCoordinator'].entries()) {
  const values = [100, 50, 80, 60, 40]
  await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts[role].cookie, body: { ...score, scores: Object.fromEntries(codes.map(k => [k, values[index]])) }, expected: 204 })
  firstExam = await exam('proposalStudent1', ex1.id)
  assert.equal(firstExam.policy_id, published.id)
  if (index < 4) assert.equal(firstExam.final_score, null)
  if (index === 0) {
   await request(a + '/proposal-exams/' + ex1.id + '/evaluation', { method: 'PUT', cookie: accounts[role].cookie, body: score, expected: 409 })
   await json(a + '/proposal-grading-policy', { method: 'POST', cookie: accounts.admin.cookie, body: { ...policy, name: 'Versi berikutnya; ujian lama tetap memakai aturan sebelumnya', panel_weights: Object.fromEntries(Object.keys(policy.panel_weights).map(k => [k, 20])) } })
  }
 }
 const parallel = await Promise.all([1, 2].map(() => request(a + '/proposal-exams/' + ex2.id + '/evaluation', { method: 'PUT', cookie: accounts.lecturer2.cookie, body: score, expected: [204, 409] })))
 assert.deepEqual(parallel.map(r => r.status).sort(), [204, 409])
 assert.ok(!JSON.stringify(firstExam).includes('signature_key'))
 assert.equal(firstExam.final_score, 72); assert.equal(firstExam.letter, 'B'); assert.equal(firstExam.attendance.length, 1)
 const baselinePdf = await request(a + '/proposal-exams/' + ex1.id + '/report?kind=minutes', { cookie: accounts.tu.cookie }); const baselineBytes = Buffer.from(await baselinePdf.arrayBuffer())
 await signature('lecturer1', 1)
 const afterPdf = Buffer.from(await (await request(a + '/proposal-exams/' + ex1.id + '/report?kind=minutes', { cookie: accounts.tu.cookie })).arrayBuffer())
 assert.equal((await exam('proposalStudent1', ex1.id)).final_score, 72)
 assert.ok(baselineBytes.includes(Buffer.from('/Subtype /Image')) && afterPdf.includes(Buffer.from('/Subtype /Image')))
 for (const kind of ['minutes', 'attendance', ...firstExam.panel.map(p => 'score&evaluator_id=' + p.id)]) {
  const res = await request(a + '/proposal-exams/' + ex1.id + '/report?kind=' + kind, { cookie: accounts.proposalStudent1.cookie })
  const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
  await writeFile(resolve(root, 'infrastructure/.run/artifacts/proposal-' + kind.replaceAll(/[^a-z0-9-]/gi, '-') + '.pdf'), bytes)
 }
 assert.equal((await json(a + '/dashboard', { cookie: accounts.proposalStudent1.cookie })).stats.sempro_approved, 1)
 assert.equal((await json(a + '/dashboard', { cookie: accounts.proposalStudent2.cookie })).stats.sempro_scheduled, 1)
 console.log('PASS: revisi proposal individu, enam berkas, filter/Excel, panel per mahasiswa, otorisasi, tanda tangan privat, aturan versi, nilai lengkap lima dosen, serta tujuh dokumen PDF.')
}
