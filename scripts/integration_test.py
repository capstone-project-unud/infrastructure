"""Exercise live services using disposable TEST records; remove only those records afterward."""
from pathlib import Path
import http.cookiejar
import json
import secrets
import sys
import urllib.request
import urllib.error
import uuid
import psycopg
from bootstrap import ROOT, load_env

BASE = 'http://127.0.0.1:8080'
created = []
checks = 0


def client():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def request(opener, method, path, body=None, expected=200, headers=None):
    global checks
    request_headers = {'Content-Type': 'application/json', **(headers or {})}
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None, headers=request_headers)
    try:
        response = opener.open(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    payload = response.read()
    assert response.code == expected, f'{method} {path}: expected {expected}, got {response.code}: {payload.decode()}'
    checks += 1
    return json.loads(payload) if payload and response.headers.get('Content-Type', '').startswith('application/json') else None


def service_env(service):
    return dict(line.split('=', 1) for line in (ROOT / 'backend' / service / '.env').read_text().splitlines() if '=' in line)


def main():
    v = load_env()
    admin, admin_jar = client()
    guest, _ = client()
    suffix = uuid.uuid4().hex[:10]
    password = secrets.token_urlsafe(18)
    new_password = secrets.token_urlsafe(18)
    student_email = f'test-student-{suffix}@example.invalid'
    lecturer_email = f'test-lecturer-{suffix}@example.invalid'
    request(guest, 'GET', '/api/v1/users', expected=401)
    request(guest, 'POST', '/api/v1/auth/login', {'email': 'missing@example.invalid', 'password': password}, expected=401)
    request(guest, 'POST', '/api/v1/auth/login', {}, expected=403, headers={'Origin': 'https://evil.example'})
    request(guest, 'GET', '/internal/bootstrap', expected=404)
    request(admin, 'POST', '/api/v1/auth/login', {'email': v['ADMIN_EMAIL'], 'password': v['ADMIN_PASSWORD']})
    cookie = list(admin_jar)[0]
    assert cookie.has_nonstandard_attr('HttpOnly') and cookie.get_nonstandard_attr('SameSite') == 'Strict'
    admin_id = request(admin, 'GET', '/api/v1/me')['user']['id']
    student = {'full_name': 'TEST Mahasiswa Integrasi', 'email': student_email,
        'roles': ['MAHASISWA'], 'nim': 'TEST' + suffix, 'admission_year': 2023, 'password': password}
    student_id = request(admin, 'POST', '/api/v1/users', student, expected=201)['user']['id']
    created.append(student_id)
    request(admin, 'POST', '/api/v1/users', student, expected=409)
    request(admin, 'POST', '/api/v1/users', {**student, 'email': f'test-invalid-{suffix}@example.invalid', 'nim': None}, expected=422)
    request(admin, 'POST', '/api/v1/users', {**student, 'roles': ['ADMIN']}, expected=422)
    lecturer = {'full_name': 'TEST Dosen Integrasi', 'email': lecturer_email, 'roles': ['DOSEN', 'KOPRODI'], 'nip': 'TEST' + suffix, 'password': password}
    lecturer_id = request(admin, 'POST', '/api/v1/users', lecturer, expected=201)['user']['id']
    created.append(lecturer_id)
    filtered = request(admin, 'GET', '/api/v1/users?q=' + suffix + '&role=MAHASISWA')
    assert filtered['total'] == 1 and filtered['items'][0]['id'] == student_id
    request(admin, 'GET', '/api/v1/users/stats')
    student_client, student_jar = client()
    request(student_client, 'POST', '/api/v1/auth/login', {'email': student_email.upper(), 'password': password})
    request(student_client, 'GET', '/api/v1/users', expected=403)
    request(student_client, 'PUT', '/api/v1/me', {'full_name': 'TEST Mahasiswa Diperbarui', 'email': student_email, 'phone': '080000000000', 'roles': ['ADMIN'], 'is_active': True})
    me = request(student_client, 'GET', '/api/v1/me')['user']
    assert me['roles'] == ['MAHASISWA'] and me['phone'] == '080000000000'
    old_cookie = list(student_jar)[0].value
    request(admin, 'PATCH', f'/api/v1/users/{student_id}/status', {'is_active': False}, expected=204)
    request(student_client, 'GET', '/api/v1/me', expected=401)
    request(guest, 'POST', '/api/v1/auth/login', {'email': student_email, 'password': password}, expected=401)
    request(admin, 'PATCH', f'/api/v1/users/{student_id}/status', {'is_active': True}, expected=204)
    request(guest, 'GET', '/api/v1/me', expected=401, headers={'Cookie': f'capstone_session={old_cookie}'})
    request(student_client, 'POST', '/api/v1/auth/login', {'email': student_email, 'password': password})
    request(student_client, 'PUT', '/api/v1/auth/password', {'current_password': password, 'new_password': new_password}, expected=204)
    request(student_client, 'GET', '/api/v1/me', expected=401)
    request(student_client, 'POST', '/api/v1/auth/login', {'email': student_email, 'password': new_password})
    request(admin, 'PUT', f'/api/v1/users/{student_id}/password', {'password': password}, expected=204)
    request(student_client, 'GET', '/api/v1/me', expected=401)
    request(admin, 'PUT', f'/api/v1/users/{lecturer_id}', {**lecturer, 'full_name': 'TEST Dosen Diperbarui', 'expertise': 'Pengujian sistem'})
    request(admin, 'PATCH', f'/api/v1/users/{admin_id}/status', {'is_active': False}, expected=422)
    audit = request(admin, 'GET', '/api/v1/users/audit')['items']
    assert any(item['action'] == 'PASSWORD_RESET' for item in audit)
    auth_url = service_env('auth-service')['DATABASE_URL']
    user_url = service_env('user-service')['DATABASE_URL']
    with psycopg.connect(auth_url) as conn:
        hashes = conn.execute('SELECT password_hash FROM auth_service.credentials WHERE user_id=%s', (student_id,)).fetchone()
        assert hashes and hashes[0].startswith('$2a$') and hashes[0] != password
        assert not conn.execute("SELECT 1 FROM information_schema.tables WHERE table_schema='user_service'").fetchone()
    with psycopg.connect(user_url) as conn:
        assert not conn.execute("SELECT 1 FROM information_schema.tables WHERE table_schema='auth_service'").fetchone()
    admin_cookie = cookie.value
    request(admin, 'POST', '/api/v1/auth/logout', {}, expected=204)
    request(guest, 'GET', '/api/v1/me', expected=401, headers={'Cookie': f'capstone_session={admin_cookie}'})
    print(f'PASS: {checks} HTTP assertions; credential hashing, session cookie attributes, and database separation verified.')


if __name__ == '__main__':
    try:
        main()
    finally:
        if created:
            with psycopg.connect(service_env('auth-service')['DATABASE_URL']) as conn:
                conn.execute('DELETE FROM auth_service.credentials WHERE user_id=ANY(%s::uuid[])', (created,))
            with psycopg.connect(service_env('user-service')['DATABASE_URL']) as conn:
                conn.execute('DELETE FROM user_service.audit_logs WHERE target_id=ANY(%s::uuid[])', (created,))
                conn.execute('DELETE FROM user_service.users WHERE id=ANY(%s::uuid[])', (created,))
            print('Disposable TEST accounts and associated records removed.')
