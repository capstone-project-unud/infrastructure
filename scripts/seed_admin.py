"""Provision the initial administrator once through the private user-service API."""
import json
import urllib.request
import urllib.error
import os
from bootstrap import load_env

values = load_env()
request = urllib.request.Request(os.environ.get('USER_SERVICE_URL', 'http://127.0.0.1:8082') + '/internal/bootstrap',
    data=json.dumps({'full_name': 'Administrator Capstone', 'email': values['ADMIN_EMAIL'],
                     'password': values['ADMIN_PASSWORD']}).encode(),
    headers={'Content-Type': 'application/json', 'X-Service-Token': values['USER_INTERNAL_TOKEN']})
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        print('Initial administrator created. Read ADMIN_EMAIL and ADMIN_PASSWORD from infrastructure/.env.')
except urllib.error.HTTPError as error:
    if error.code == 409:
        print('Initial administrator already exists; no changes made.')
    else:
        raise
