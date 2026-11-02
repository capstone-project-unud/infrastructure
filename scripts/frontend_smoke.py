"""Verify production/dev HTTP rendering and session cookies through the Nuxt BFF."""
import http.cookiejar
import json
import os
import re
import time
import urllib.error
import urllib.request
from bootstrap import load_env

BASE = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
values = load_env()
cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
deadline = time.monotonic() + 60
while True:
    try:
        with client.open(BASE + '/login', timeout=3) as response:
            assert response.status == 200
            login = response.read().decode()
            assert 'Selamat datang.' in login
            assert '<footer' not in login
            assert all(text not in login for text in ['Satu akun, sesuai peran Anda.',
                'Mahasiswa · Dosen · Admin', 'Portal akademik'])
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

for path, heading in [('/admin/users', 'Manajemen pengguna'),
                       ('/admin/activity', 'Aktivitas pengguna'), ('/account', 'Profil saya')]:
    with client.open(BASE + path) as response:
        page = response.read().decode()
        assert response.status == 200 and heading in page
        assert '<footer' not in page
        assert all(text not in page for text in ['Akses yang tepat, untuk setiap peran.',
            'Ruang kerja admin', 'Sistem Layanan Capstone Project'])
        assert 'aria-controls="workspace-navigation"' in page
        assert 'aria-label="Minimalkan sidebar"' in page
        assert 'aria-expanded="true"' in page
    print('PASS rendering:', path)

request = urllib.request.Request(BASE + '/admin/users')
cookies.add_cookie_header(request)
session_cookies = '; '.join(part.strip() for part in request.get_header('Cookie', '').split(';')
    if part.strip() and not part.strip().startswith('capstone_sidebar_collapsed='))
request.add_unredirected_header('Cookie', session_cookies + '; capstone_sidebar_collapsed=true')
with client.open(request) as response:
    page = response.read().decode()
    assert 'sidebar-minimized' in page
    assert 'aria-label="Perluas sidebar"' in page and 'aria-expanded="false"' in page
    navigation = re.search(r'<nav\b[^>]*id="workspace-navigation"[^>]*>(.*?)</nav>', page, re.S)
    assert navigation and 'navigation-label' not in navigation.group(1)
    assert 'aria-label="Manajemen pengguna"' in navigation.group(1)
    assert 'title="Manajemen pengguna"' in navigation.group(1)
print('PASS: persisted sidebar preference renders on the server with accessible icon links.')

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
print('PASS: login, local font, session cookie, SSR pages, sidebar preference, logout, protected redirect, and BFF origin rejection.')
