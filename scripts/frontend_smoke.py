"""Verify production/dev HTTP rendering and session cookies through the Nuxt BFF."""
import http.cookiejar
import json
import time
import urllib.error
import urllib.request
from bootstrap import load_env

BASE = 'http://localhost:3000'
values = load_env()
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
deadline = time.monotonic() + 60
while True:
    try:
        with client.open(BASE + '/login', timeout=3) as response:
            assert response.status == 200
            assert 'Selamat datang.' in response.read().decode()
        break
    except (urllib.error.URLError, TimeoutError):
        if time.monotonic() >= deadline:
            raise
        time.sleep(0.5)

with client.open(BASE + '/fonts/urbanist-latin.woff2') as response:
    assert response.status == 200 and len(response.read()) > 10000

request = urllib.request.Request(BASE + '/api/v1/auth/login',
    data=json.dumps({'email': values['ADMIN_EMAIL'], 'password': values['ADMIN_PASSWORD']}).encode(),
    headers={'Content-Type': 'application/json', 'Origin': BASE})
with client.open(request) as response:
    assert response.status == 200 and response.headers['Content-Type'].startswith('application/json')
    assert json.loads(response.read())['user']['email'] == values['ADMIN_EMAIL']
assert list(cookies)[0].has_nonstandard_attr('HttpOnly')

for path, heading in [('/admin/users', 'Kelola orang di balik karya.'),
                       ('/admin/activity', 'Aktivitas pengguna'), ('/account', 'Profil saya')]:
    with client.open(BASE + path) as response:
        assert response.status == 200 and heading in response.read().decode()
    print('PASS rendering:', path)

request = urllib.request.Request(BASE + '/api/v1/auth/logout', data=b'{}',
    headers={'Content-Type': 'application/json', 'Origin': BASE})
with client.open(request) as response:
    assert response.status == 204
with client.open(BASE + '/admin/users') as response:
    assert response.geturl() == BASE + '/login'

request = urllib.request.Request(BASE + '/api/v1/auth/login', data=b'{}',
    headers={'Content-Type': 'application/json', 'Origin': 'https://evil.example'})
try:
    client.open(request)
    raise AssertionError('Cross-origin request accepted')
except urllib.error.HTTPError as error:
    assert error.code == 403
print('PASS: login, local font, session cookie, SSR pages, logout, protected redirect, and BFF origin rejection.')
