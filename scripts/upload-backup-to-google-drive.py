#!/usr/bin/env python3
import hashlib, json, os
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

HOME = Path.home()
TOKEN = HOME / '.hermes/google_token.json'
BACKUP_DIR = Path(os.environ.get('BAGIHASIL_BACKUP_DIR', HOME / '.secure-backups/bagihasil/automated'))
FOLDER = 'Bagihasil Production Backups'
SCOPES = ['https://www.googleapis.com/auth/drive']

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def creds():
    c = Credentials.from_authorized_user_info(json.loads(TOKEN.read_text()), SCOPES)
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN.write_text(c.to_json())
        TOKEN.chmod(0o600)
    if not c.valid:
        raise SystemExit('Google OAuth token invalid')
    return c

def folder(service):
    q = "name = 'Bagihasil Production Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    found = service.files().list(q=q, spaces='drive', fields='files(id)', pageSize=10).execute().get('files', [])
    if found:
        return found[0]['id']
    return service.files().create(body={'name': FOLDER, 'mimeType': 'application/vnd.google-apps.folder'}, fields='id').execute()['id']

def upload(service, parent, path):
    sha = digest(path)
    q = "name = '%s' and '%s' in parents and trashed = false" % (path.name.replace("'", "\\'"), parent)
    found = service.files().list(q=q, spaces='drive', fields='files(id,size,description)', pageSize=10).execute().get('files', [])
    if found:
        remote = found[0]
        if sha not in (remote.get('description') or ''):
            raise SystemExit('Remote checksum mismatch: ' + path.name)
        return {'name': path.name, 'action': 'already_present', 'sha256': sha}
    media = MediaFileUpload(str(path), mimetype='application/octet-stream', resumable=True)
    remote = service.files().create(body={'name': path.name, 'parents': [parent], 'description': 'sha256=' + sha}, media_body=media, fields='id,size').execute()
    if int(remote.get('size', -1)) != path.stat().st_size:
        raise SystemExit('Remote size mismatch: ' + path.name)
    return {'name': path.name, 'action': 'uploaded', 'sha256': sha}

def main():
    candidates = sorted(BACKUP_DIR.glob('*.dump.gpg'), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise SystemExit('No encrypted backup found')
    artifact = candidates[0]
    files = [artifact, Path(str(artifact) + '.sha256'), Path(str(artifact) + '.manifest'), Path(str(artifact) + '.restore-list')]
    for path in files:
        if not path.is_file() or path.stat().st_mode & 0o077:
            raise SystemExit('Missing or insecure artifact: ' + str(path))
    service = build('drive', 'v3', credentials=creds(), cache_discovery=False)
    parent = folder(service)
    print(json.dumps({'folder': FOLDER, 'encrypted_only': True, 'files': [upload(service, parent, p) for p in files]}, separators=(',', ':')))

if __name__ == '__main__':
    main()
