#!/usr/bin/env python3
"""Save README/license evidence for audited public repositories; does not run their code."""
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
repos = json.loads((OUT / 'github-repositories.json').read_text())['repositories']

def fetch(url):
    return subprocess.run(['curl', '-fLsS', '--max-time', '30',
                           '-H', 'User-Agent: rentApartment-research', url],
                          capture_output=True, check=True).stdout

def run(repo):
    if repo['status'] != 'ok':
        return {'repository': repo['requested_repo'], 'status': 'unavailable'}
    name = repo['full_name']
    folder = OUT / name.replace('/', '__')
    folder.mkdir(exist_ok=True)
    result = {'repository': name, 'files': []}
    try:
        entries = json.loads(fetch('https://api.github.com/repos/' + name + '/contents/'))
        (folder / 'root-files.json').write_text(json.dumps(entries, indent=2) + '\n')
        for f in entries:
            n = f['name'].lower()
            if f['type'] != 'file' or not (n.startswith('readme') or n.startswith('license') or n.startswith('licence') or n.startswith('copying')):
                continue
            try:
                raw = fetch(f['download_url'])
                (folder / f['name']).write_bytes(raw)
                result['files'].append({'path': f['path'], 'url': f['html_url'],
                                        'raw_url': f['download_url'], 'git_blob_sha': f['sha'],
                                        'sha256': hashlib.sha256(raw).hexdigest(), 'status': 'ok'})
            except Exception as e:
                result['files'].append({'path': f['path'], 'status': 'error', 'error': str(e)})
        result['status'] = 'ok'
    except Exception as e:
        result.update(status='error', error=str(e))
    return result

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    data = list(pool.map(run, repos))
(OUT / 'source-manifest.json').write_text(json.dumps({
    'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
    'note': 'READMEs are upstream claims, not runtime verification; licenses may have package-specific exceptions.',
    'repositories': data}, indent=2) + '\n')
for row in data:
    print(row['repository'], row['status'], ', '.join(f['path'] for f in row.get('files', [])))
