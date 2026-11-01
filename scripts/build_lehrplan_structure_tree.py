"""Builds the Thueringen Lehrplan structure tree (grade band > topic > subtopic) from the live goals of evomentor-thuringia and the PDF order file.

Output: scripts/data/thueringen_lehrplan_structure_tree_2026_11_02.json. Each topic node lists its subtopics with the number of goals, up to four of
our own short goal titles and the printed PDF pages (grades 7 to 10 only, from scripts/data/lernziele-lehrplan-order-2026-10-30.json).
First input of the state curriculum overview (lab_manager design note state-curriculum-overview-browse-check-translate-2026-11-02.md).
Run from the openlpm folder: python scripts/build_lehrplan_structure_tree.py (needs .supabase-secrets/service-role-key.txt, read-only).
"""
import ast, collections, json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'scripts', 'data')
os.makedirs(OUT, exist_ok=True)
KEY = open(os.path.join(ROOT, '.supabase-secrets', 'service-role-key.txt')).read().strip()
U = 'https://tfynvjjxyluzorigyfsp.supabase.co/rest/v1/'


def get(p):
    out, off = [], 0
    while True:
        r = urllib.request.Request(U + p + f'&limit=1000&offset={off}', headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY})
        pg = json.load(urllib.request.urlopen(r))
        out += pg
        if len(pg) < 1000:
            return out
        off += 1000


live = get('projects?select=id&slug=eq.evomentor-thuringia')[0]['id']
goals = get(f'lpm_data_objects?select=id,title,grade_band,curriculum_sequence,content&project_id=eq.{live}&status=eq.accepted')
order = json.load(open(os.path.join(ROOT, 'scripts', 'data', 'lernziele-lehrplan-order-2026-10-30.json'), encoding='utf-8'))
pages = {}
for band, entries in order['bands'].items():
    for e in entries:
        gb = '7/8' if band == '7/8' else e['grade_now']
        pages.setdefault((gb, e['lernbereich'], e['unterthema']), set()).add(e['printed_page'])

tree = collections.OrderedDict()
for g in sorted(goals, key=lambda g: ({'5/6': 0, '7/8': 1, '9': 2, '10': 3}.get(g['grade_band'], 9), g['curriculum_sequence'] if g['curriculum_sequence'] is not None else 1e9)):
    c = g['content'] if isinstance(g['content'], dict) else ast.literal_eval(g['content'])
    band, thema, unter = g['grade_band'], c.get('thema') or '', c.get('unterthema') or ''
    t = tree.setdefault((band, thema), collections.OrderedDict())
    s = t.setdefault(unter, {'titles': [], 'n': 0})
    s['n'] += 1
    if len(s['titles']) < 4:
        s['titles'].append(g['title'])

nodes = []
for (band, thema), subs in tree.items():
    nodes.append({'band': band, 'topic': thema, 'n': sum(s['n'] for s in subs.values()),
                  'subtopics': [{'label': u, 'n': s['n'], 'sample_titles': s['titles'],
                                 'pages': sorted(pages.get((band, thema, u), []), key=lambda x: int(x))} for u, s in subs.items()]})
json.dump(nodes, open(os.path.join(OUT, 'thueringen_lehrplan_structure_tree_2026_11_02.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('topic nodes', len(nodes), '| subtopic nodes', sum(len(n['subtopics']) for n in nodes), '| goals', sum(n['n'] for n in nodes))
print(collections.Counter(n['band'] for n in nodes))
for n in nodes[:3] + nodes[-3:]:
    print(n['band'], '|', n['topic'], '|', n['n'], '|', [s['label'][:30] for s in n['subtopics']][:3])
print('subtopics with pages:', sum(1 for n in nodes for s in n['subtopics'] if s['pages']))
