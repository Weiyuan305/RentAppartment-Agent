#!/usr/bin/env python3
"""Collect public GitHub metadata; no credentials, installs or repository code execution."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import subprocess

REPOS = [
    'maplibre/maplibre-gl-js', 'visgl/react-map-gl', 'CesiumGS/cesium',
    'CesiumGS/cesiumjs-ai-starter-app', 'CesiumGS/cesium-ai-integrations',
    'reearth/resium', 'visgl/deck.gl', 'NASA-AMMOS/3DTilesRendererJS',
    'protomaps/PMTiles', 'maplibre/martin', 'openmaptiles/openmaptiles',
    'valhalla/valhalla', 'GIScience/openrouteservice', 'graphhopper/graphhopper',
    'Project-OSRM/osrm-backend', 'postgis/postgis', 'Turfjs/turf',
    'osm-search/Nominatim', 'komoot/photon', 'vercel/ai',
    'assistant-ui/assistant-ui', 'langchain-ai/langgraph',
    'bradtraversy/property-pulse-nextjs', 'AntonioErdeljac/next13-airbnb-clone',
    'safak/full-stack-estate', 'sharetribe/sharetribe',
    'davidjerleke/embla-carousel', 'pmndrs/zustand',
    'googlemaps-samples/js-3d-area-explorer',
]
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'evidence'
OUT.mkdir(exist_ok=True)

def get_json(url):
    # System curl uses the host trust store; do not disable TLS verification.
    result = subprocess.run(['curl', '--fail', '--silent', '--show-error',
                             '--location', '--max-time', '30',
                             '-H', 'User-Agent: rentApartment-research',
                             '-H', 'Accept: application/vnd.github+json', url],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout)

def collect(repo):
    url = f'https://api.github.com/repos/{repo}'
    try:
        data = get_json(url)
        (OUT / (repo.replace('/', '__') + '.json')).write_text(
            json.dumps(data, indent=2, ensure_ascii=False) + '\n')
        keys = ['full_name', 'html_url', 'description', 'default_branch',
                'stargazers_count', 'pushed_at', 'updated_at', 'archived',
                'disabled', 'license', 'homepage', 'language']
        return {'requested_repo': repo, 'api_url': url, 'status': 'ok',
                **{k: data.get(k) for k in keys}}
    except Exception as e:
        return {'requested_repo': repo, 'api_url': url, 'status': 'error',
                'error': str(e), 'detail': getattr(e, 'stderr', None)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(collect, REPOS))
payload = {'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
           'method': 'Unauthenticated public GitHub REST API. pushed_at is not a default-branch commit timestamp.',
           'repositories': results}
(OUT / 'github-repositories.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
for row in results:
    lic = (row.get('license') or {}).get('spdx_id', 'UNKNOWN')
    print(row['requested_repo'], row['status'], row.get('stargazers_count'),
          row.get('pushed_at'), lic, 'archived=' + str(row.get('archived')))
