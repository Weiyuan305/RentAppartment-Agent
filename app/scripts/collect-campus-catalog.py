"""Curate bounded OSM official API extracts; never invent building coordinates."""
import json
import subprocess
import os
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BOUNDS = {'london':[-.146,51.518,-.122,51.532],'sydney':[151.176,-33.898,151.199,-33.878],'singapore':[103.763,1.284,103.789,1.309],'kuala-lumpur':[101.641,3.106,101.669,3.135],'hong-kong':[114.126,22.276,114.145,22.29]}
CACHE = Path(os.environ.get('ATLAS_CAMPUS_CACHE', '/private/tmp'))
CACHE.mkdir(parents=True, exist_ok=True)
SELECTION = {
    'london': [680050665,681098586,50059492,40205764,27702973,802236338,863409196,849005554,51517608,789265602,40253190,40205769,40269405,27703173,483804431,15703989,27702997,27703147,845163820,27703112],
    'sydney': [16784706,45474350,45474427,175377608,205131027,661062521],
    'singapore': [54583490,140087160,54583487,142079835,141913116,54583930],
    'kuala-lumpur': [263611204,278144675,358006164,358006165,358009625,359488999],
    'hong-kong': [182023175,182023171,182023173,182172764,182208619,182172765],
}
SCHOOLS = {
    'london': ('UCL','Bloomsbury','https://www.ucl.ac.uk/maps'),
    'sydney': ('University of Sydney','Camperdown / Darlington','https://maps.sydney.edu.au/'),
    'singapore': ('National University of Singapore','Kent Ridge','https://map.nus.edu.sg/'),
    'kuala-lumpur': ('Universiti Malaya','Main campus','https://www.um.edu.my/campus-map'),
    'hong-kong': ('The University of Hong Kong','Main campus','https://www.maps.hku.hk/'),
}
ALIASES={680050665:['Wilkins','威尔金斯楼','主楼'],681098586:['Student Centre','学生中心'],849005554:['DMS Watson','Science Library','科学图书馆'],789265602:['IOE Library','教育学院图书馆'],51517608:['IOE','教育学院'],483804431:['Bartlett','巴特莱特'],845163820:['Refectory','食堂'],16784706:['Fisher','费雪图书馆'],45474350:['Carslaw','卡斯劳'],45474427:['Law Building','法学院楼'],175377608:['Computer Science','计算机楼'],54583490:['Central Library','CLB','中央图书馆'],140087160:['BIZ1','商学院','Mochtar Riady'],54583487:['Health Centre','校医院'],142079835:['AS7','Shaw Foundation'],263611204:['Main Library','主图书馆'],278144675:['DTC','大礼堂'],359488999:['Cafeteria','食堂'],182023175:['Main Library','主图书馆','本部图书馆'],182023171:['Knowles','钮鲁诗楼'],182023173:['KK Leung','梁銶琚楼'],182172764:['Chow Yei Ching','周亦卿楼']}
collected = datetime.now(timezone.utc).isoformat()
buildings=[];campuses=[]
for city,ids in SELECTION.items():
    university,campus,official=SCHOOLS[city];campus_id=city+'-main'
    campuses.append({'id':campus_id,'cityId':city,'university':university,'name':campus,'officialUrl':official})
    source=CACHE/('atlas-campus-'+city+'.osm')
    if not source.exists():
        temporary=source.with_suffix('.download')
        subprocess.run(['curl','--fail','--silent','--show-error','--max-time','90','--retry','2','--output',str(temporary),'https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,BOUNDS[city]))],check=True)
        ET.parse(temporary) # Keep a failed or truncated response out of the reusable cache.
        temporary.replace(source)
    root=ET.parse(source).getroot()
    source_collected = datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat()
    nodes={n.attrib['id']:n for n in root.findall('node')}
    ways={int(w.attrib['id']):w for w in root.findall('way')}
    for identifier in ids:
        w=ways[identifier];tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};name=tags['name']
        points=[nodes[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in nodes]
        if points[0].attrib['id']==points[-1].attrib['id']:points=points[:-1]
        entrances=[]
        for point in points:
            t={t.attrib['k']:t.attrib['v'] for t in point.findall('tag')}
            if t.get('entrance')=='main' and t.get('access') not in ('no','private'):entrances.append(point)
        if entrances:lat=float(entrances[0].attrib['lat']);lng=float(entrances[0].attrib['lon']);kind='mapped-entrance'
        else:lat=sum(float(p.attrib['lat']) for p in points)/len(points);lng=sum(float(p.attrib['lon']) for p in points)/len(points);kind='building-center'
        category='library' if any(x in name.lower() for x in ['library','perpustakaan','圖書館']) or identifier==849005554 else 'dining' if identifier in [845163820,359488999] else 'services' if identifier in [681098586,54583487,54583930,182172765,661062521] else 'teaching'
        buildings.append({'id':f'way/{identifier}','cityId':city,'campusId':campus_id,'name':name,'aliases':list(dict.fromkeys(ALIASES.get(identifier,[])+[v for k,v in tags.items() if k in ['name:en','name:zh','short_name','ref']])),'category':category,'lng':round(lng,7),'lat':round(lat,7),'locationType':kind,'source':{'url':f'https://www.openstreetmap.org/way/{identifier}','officialUrl':official,'collectedAt':source_collected}})
data={'version':1,'provider':'OpenStreetMap','attribution':'© OpenStreetMap contributors; ODbL','campuses':campuses,'buildings':buildings}
(ROOT/'lib/student/data/campuses.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
evidence=ROOT.parent/'research/evidence/campus-planner';evidence.mkdir(parents=True,exist_ok=True)
(evidence/'catalog-provenance.json').write_text(json.dumps({'collectedAt':collected,'endpoint':'https://api.openstreetmap.org/api/0.6/map','bounds':{'london':[-.146,51.518,-.122,51.532],'sydney':[151.176,-33.898,151.199,-33.878],'singapore':[103.763,1.284,103.789,1.309],'kuala-lumpur':[101.641,3.106,101.669,3.135],'hong-kong':[114.126,22.276,114.145,22.29]},'selection':SELECTION,'entranceRule':'Only mapped entrance=main, access not no/private. Otherwise footprint vertex average; explicitly not a verified entrance.'},ensure_ascii=False,indent=2)+'\n')
print(f'{len(buildings)} sourced buildings in {len(campuses)} campuses; {sum(b["locationType"]=="mapped-entrance" for b in buildings)} mapped main entrances.')
