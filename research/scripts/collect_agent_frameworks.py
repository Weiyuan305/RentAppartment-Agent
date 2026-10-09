#!/usr/bin/env python3
"""Collect public, read-only agent framework evidence without installing packages."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1] / 'evidence' / 'agent-frameworks'
ROOT.mkdir(parents=True, exist_ok=True)
REPOS = ['vercel/ai', 'openai/openai-agents-js', 'mastra-ai/mastra',
         'langchain-ai/langgraphjs', 'cloudflare/agents', 'huggingface/smolagents']
PACKAGES = ['ai', '@ai-sdk/react', '@ai-sdk/openai', '@openai/agents',
            '@openai/agents-core', '@mastra/core', '@langchain/langgraph', 'agents']

def fetch(url):
    result = subprocess.run(['curl', '--fail', '--silent', '--show-error',
                             '--location', '--connect-timeout', '10', '--max-time', '35',
                             '-H', 'User-Agent: rentApartment-agent-research',
                             '-H', 'Accept: application/json', url],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout)

def save(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def repository(repo):
    slug = repo.replace('/', '__')
    try:
        url = f'https://api.github.com/repos/{repo}'
        data = fetch(url)
        save(slug + '.json', data)
        commit_url = f'{url}/commits/{quote(data["default_branch"], safe="")}'
        commit = fetch(commit_url)
        save(slug + '.head.json', commit)
        return {'repo': repo, 'status': 'ok', 'url': data['html_url'],
                'stars': data['stargazers_count'], 'archived': data['archived'],
                'license': data.get('license'), 'created_at': data['created_at'],
                'head_sha': commit['sha'], 'head_committed_at': commit['commit']['committer']['date'],
                'metadata_url': url, 'commit_url': commit_url}
    except Exception as error:
        return {'repo': repo, 'status': 'error', 'error': str(error),
                'detail': getattr(error, 'stderr', None)}

def package(name):
    try:
        url = f'https://registry.npmjs.org/{quote(name, safe="")}/latest'
        data = fetch(url)
        save('npm-' + name.replace('@', '').replace('/', '__') + '.json', data)
        return {'package': name, 'status': 'ok', 'url': url,
                'version': data['version'], 'license': data.get('license'),
                'engines': data.get('engines'), 'dependencies': data.get('dependencies'),
                'peerDependencies': data.get('peerDependencies'), 'dist': data.get('dist')}
    except Exception as error:
        return {'package': name, 'status': 'error', 'error': str(error),
                'detail': getattr(error, 'stderr', None)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    repos = list(pool.map(repository, REPOS))
    packages = list(pool.map(package, PACKAGES))
manifest = {'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
            'method': 'Public unauthenticated GitHub REST and npm latest metadata; no installs or model calls.',
            'repositories': repos, 'packages': packages}
save('manifest.json', manifest)
for row in repos:
    print(row['repo'], row['status'], 'stars=' + str(row.get('stars')),
          'license=' + str((row.get('license') or {}).get('spdx_id')),
          'head=' + str(row.get('head_sha')), 'committed=' + str(row.get('head_committed_at')))
for row in packages:
    print(row['package'], row['status'], row.get('version'), row.get('license'),
          'engines=' + str(row.get('engines')), 'peers=' + str(row.get('peerDependencies')))
