#!/usr/bin/env python3
"""Save selected public repository files and inspect published npm archives, without executing them."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import base64

ROOT = Path(__file__).resolve().parents[1] / 'evidence' / 'agent-frameworks'
manifest = json.loads((ROOT / 'manifest.json').read_text())
FILES = {
    'vercel/ai': ['README.md', 'LICENSE', 'packages/ai/package.json', 'packages/react/package.json',
                  'content/docs/03-agents/01-overview.mdx', 'packages/ai/src/agent/tool-loop-agent.ts'],
    'openai/openai-agents-js': ['README.md', 'LICENSE', 'packages/agents/package.json', 'packages/agents-core/package.json',
                              'docs/src/content/docs/guides/sessions.mdx'],
    'mastra-ai/mastra': ['README.md', 'LICENSE.md', 'packages/core/package.json', 'docs/src/content/en/docs/agents/overview.mdx'],
    'langchain-ai/langgraphjs': ['README.md', 'LICENSE', 'libs/langgraph/package.json'],
    'cloudflare/agents': ['README.md', 'LICENSE', 'packages/agents/package.json', 'packages/ai-chat/README.md'],
    'huggingface/smolagents': ['README.md', 'LICENSE', 'pyproject.toml', 'docs/source/en/reference/agents.md'],
}

def get(url):
    return subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                           '--connect-timeout', '10', '--max-time', '40',
                           '-H', 'User-Agent: rentApartment-agent-research', url],
                          check=True, capture_output=True).stdout

def repository(row):
    if row['status'] != 'ok':
        return []
    repo = row['repo']
    results = []
    for path in FILES[repo]:
        url = f'https://raw.githubusercontent.com/{repo}/{row["head_sha"]}/{path}'
        try:
            data = get(url)
            dest = ROOT / repo.replace('/', '__') / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            results.append({'repo': repo, 'sha': row['head_sha'], 'path': path, 'url': url, 'status': 'ok',
                            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
        except Exception as error:
            results.append({'repo': repo, 'path': path, 'url': url, 'status': 'error', 'error': str(error)})
    return results

def published_package(name):
    row = next(p for p in manifest['packages'] if p['package'] == name and p['status'] == 'ok')
    dist = row['dist']
    data = get(dist['tarball'])
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if integrity != dist['integrity']:
        raise ValueError('npm integrity mismatch')
    folder = ROOT / ('published-' + name.replace('@', '').replace('/', '__') + '-' + row['version'])
    selected = []
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for item in archive.getmembers():
            path = item.name
            wanted = path in ['package/package.json', 'package/LICENSE', 'package/LICENSE.md'] or (
                name == 'ai' and (path.endswith('/agent/tool-loop-agent.ts') or
                                 ('/docs/03-agents/' in path and path.endswith('.mdx')))) or (
                name == '@ai-sdk/react' and (path.endswith('/src/use-chat.ts') or path.endswith('/docs/02-reference.mdx')))
            if not wanted or not item.isfile() or item.size > 300000:
                continue
            relative = Path(path).relative_to('package')
            if '..' in relative.parts:
                raise ValueError('Unexpected archive path')
            dest = folder / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.extractfile(item).read())
            selected.append(str(relative))
    return {'package': name, 'version': row['version'], 'url': dist['tarball'],
            'integrity_verified': True, 'archive_bytes': len(data), 'selected_files': selected,
            'execution': 'none; selected archive files read only, no package install'}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    sources = [entry for entries in pool.map(repository, manifest['repositories']) for entry in entries]
packages = [published_package(name) for name in ['ai', '@ai-sdk/react']]
(ROOT / 'inspected-sources.json').write_text(json.dumps({'sources': sources, 'published_packages': packages}, ensure_ascii=False, indent=2) + '\n')
for entry in sources:
    print(entry['status'], entry['repo'], entry['path'])
for entry in packages:
    print(entry['package'], entry['version'], 'verified archive', 'selected_files=' + str(len(entry['selected_files'])))
