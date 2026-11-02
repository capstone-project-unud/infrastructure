"""Create isolated PostgreSQL roles, apply versioned migrations, and write local env files."""
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, quote
import hashlib
import os
import secrets
import sys

ROOT = Path(__file__).resolve().parents[2]
ENV = ROOT / 'infrastructure' / '.env'


def load_env():
    values = {}
    if ENV.exists():
        values.update(line.split('=', 1) for line in ENV.read_text(encoding='utf-8').splitlines()
                      if line.strip() and not line.lstrip().startswith('#'))
    values.update({key: value for key, value in os.environ.items() if key in (
        'BOOTSTRAP_DATABASE_URL', 'AUTH_DB_PASSWORD', 'USER_DB_PASSWORD',
        'AUTH_INTERNAL_TOKEN', 'USER_INTERNAL_TOKEN', 'ADMIN_EMAIL', 'ADMIN_PASSWORD',
        'AUTH_DATABASE_NAME', 'USER_DATABASE_NAME')})
    return values


def write_env(path, values):
    path.write_text(''.join(f'{k}={v}\n' for k, v in values.items()), encoding='utf-8')


def main():
    import psycopg
    from psycopg import sql
    values = load_env()
    if not values.get('BOOTSTRAP_DATABASE_URL'):
        sys.exit('Set BOOTSTRAP_DATABASE_URL in infrastructure/.env first.')
    for key in ('AUTH_DB_PASSWORD', 'USER_DB_PASSWORD', 'AUTH_INTERNAL_TOKEN', 'USER_INTERNAL_TOKEN'):
        if not values.get(key):
            values[key] = secrets.token_urlsafe(40)
    values['ADMIN_EMAIL'] = values.get('ADMIN_EMAIL') or 'admin@capstone.local'
    values['ADMIN_PASSWORD'] = values.get('ADMIN_PASSWORD') or secrets.token_urlsafe(18)
    if any(len(values[key]) < 32 for key in ('AUTH_INTERNAL_TOKEN', 'USER_INTERNAL_TOKEN')):
        sys.exit('Internal service tokens must contain at least 32 characters.')
    if not 12 <= len(values['ADMIN_PASSWORD'].encode()) <= 72:
        sys.exit('ADMIN_PASSWORD must contain 12–72 bytes.')
    write_env(ENV, values)
    parts = urlsplit(values['BOOTSTRAP_DATABASE_URL'])
    for service, role, password_key in (
            ('auth', 'capstone_auth_app', 'AUTH_DB_PASSWORD'),
            ('user', 'capstone_user_app', 'USER_DB_PASSWORD'),
        ):
        database_name = values.get(service.upper() + '_DATABASE_NAME', parts.path.lstrip('/'))
        admin_url = urlunsplit((parts.scheme, parts.netloc, '/' + database_name, parts.query, ''))
        with psycopg.connect(admin_url, connect_timeout=20) as conn:
            schema = service + '_service'
            if not conn.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,)).fetchone():
                conn.execute(sql.SQL('CREATE ROLE {} LOGIN NOINHERIT PASSWORD {}').format(
                    sql.Identifier(role), sql.Literal(values[password_key])))
            owner = conn.execute('SELECT current_user').fetchone()[0]
            conn.execute(sql.SQL('GRANT {} TO {} WITH SET TRUE').format(
                sql.Identifier(role), sql.Identifier(owner)))
            conn.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {} AUTHORIZATION {}').format(
                sql.Identifier(schema), sql.Identifier(role)))
            conn.execute(sql.SQL('REVOKE ALL ON SCHEMA {} FROM PUBLIC').format(sql.Identifier(schema)))
            conn.execute(sql.SQL('GRANT CONNECT ON DATABASE {} TO {}').format(
                sql.Identifier(database_name), sql.Identifier(role)))
            conn.execute(sql.SQL('SET LOCAL ROLE {}').format(sql.Identifier(role)))
            conn.execute(sql.SQL('CREATE TABLE IF NOT EXISTS {}.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())').format(sql.Identifier(schema)))
            for migration in sorted((ROOT / 'backend' / (service + '-service') / 'migrations').glob('*.sql')):
                content = migration.read_text(encoding='utf-8')
                checksum = hashlib.sha256(content.encode()).hexdigest()
                existing = conn.execute(sql.SQL('SELECT checksum FROM {}.schema_migrations WHERE version=%s').format(sql.Identifier(schema)), (migration.name,)).fetchone()
                if existing and existing[0] != checksum:
                    raise RuntimeError(f'Applied migration changed: {migration.name}')
                if not existing:
                    conn.execute(content, prepare=False)
                    conn.execute(sql.SQL('INSERT INTO {}.schema_migrations(version,checksum) VALUES(%s,%s)').format(sql.Identifier(schema)), (migration.name, checksum))
                    print(f'Applied {service}-service/{migration.name}')
            conn.execute('RESET ROLE')
            netloc = f'{role}:{quote(values[password_key], safe="")}@{parts.hostname}'
            if parts.port:
                netloc += f':{parts.port}'
            runtime_url = urlunsplit((parts.scheme, netloc, '/' + database_name, parts.query, ''))
            write_env(ROOT / 'backend' / (service + '-service') / '.env', {
                'DATABASE_URL': runtime_url,
                'PORT': '8081' if service == 'auth' else '8082',
                'AUTH_SERVICE_URL': 'http://127.0.0.1:8081',
                'USER_SERVICE_URL': 'http://127.0.0.1:8082',
                'AUTH_INTERNAL_TOKEN': values['AUTH_INTERNAL_TOKEN'],
                'USER_INTERNAL_TOKEN': values['USER_INTERNAL_TOKEN'],
                'COOKIE_SECURE': 'false',
            })
    write_env(ROOT / 'backend' / 'api-gateway' / '.env', {
        'PORT': '8080', 'AUTH_SERVICE_URL': 'http://127.0.0.1:8081',
        'USER_SERVICE_URL': 'http://127.0.0.1:8082', 'ALLOWED_ORIGIN': 'http://localhost:3000', 'TRUST_BFF': 'true',
    })
    write_env(ROOT / 'frontend' / '.env', {'NUXT_GATEWAY_URL': 'http://127.0.0.1:8080'})
    print('Database schemas and restricted runtime roles ready. Credentials remain in ignored .env files.')


if __name__ == '__main__':
    main()
