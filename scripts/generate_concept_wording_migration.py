#!/usr/bin/env python3
"""Makes migration 209: wording changes to the Basiskonzept concept texts, from Susan Hanisch's feedback of 2026-10-30.

Every edit names the record by label, carries the exact old text as a guard, and so only changes a record that still says what
it said when Susan wrote her comment. The same concept texts exist in the live space evomentor-thuringia and its sandbox copy, so each
edit runs for both. (The project "evomentor" words these texts differently and is left alone.)

Usage: python scripts/generate_concept_wording_migration.py --out supabase/migrations/209_basiskonzept_wording_from_susans_feedback.sql
       python scripts/generate_concept_wording_migration.py --check <elements.json>   (every guard matches in each project)
"""
import argparse
import json

SLUGS = ('evomentor-thuringia', 'evomentor-thuringia-sandbox')

# (feedback row ids, label, kind, old, new). kind: 'definition' | 'didactic' | 'beispiel' | 'misconception2'
EDITS = [
    ('00bebea8', 'Informationsverarbeitung', 'definition',
     'Die Aufnahme, Weiterleitung, Verarbeitung und Beantwortung von Signalen durch ein Lebewesen oder eine seiner Teilstrukturen.',
     'Die Aufnahme, Weiterleitung und Verarbeitung von Signalen sowie die Reaktion darauf durch ein Lebewesen oder eine seiner Teilstrukturen.'),
    ('19caa090', 'Kommunikation zwischen Organismen', 'definition',
     'Der Austausch von Signalen zwischen Individuen derselben oder verschiedener Arten, durch den das Verhalten des Empfängers zugunsten (meist) des Senders beeinflusst wird.',
     'Der Austausch von Signalen zwischen Individuen derselben oder verschiedener Arten, durch den das Verhalten des Empfängers beeinflusst wird.'),
    ('1aac170f', 'Offene Systeme', 'definition',
     'Systeme, die sowohl Stoffe als auch Energie mit ihrer Umgebung austauschen — im Gegensatz zu geschlossenen Systemen, die nur Energie, oder isolierten Systemen, die weder Stoffe noch Energie austauschen.',
     'Systeme, die Stoffe und Energie mit ihrer Umgebung austauschen. Geschlossene Systeme tauschen nur Energie aus, isolierte Systeme weder Stoffe noch Energie.'),
    ('1fc022f5 4ea1e2dd', 'Evolutive Entwicklung', 'misconception2',
     'Evolution betrifft Populationen über Generationen, nicht Individuen; erworbene Merkmale werden nicht vererbt',
     'Evolution betrifft Populationen über Generationen, nicht einzelne Individuen. Körperliche Veränderungen, die ein Individuum im Lauf seines Lebens erwirbt, werden nicht genetisch vererbt. Erlernte Verhaltensweisen können dagegen durch soziales Lernen an die nächste Generation weitergegeben werden; auch das ist eine Form der Vererbung, die ohne die Gene auskommt.'),
    ('22613921', 'Koevolution', 'beispiel',
     'Blüten und ihre spezialisierten Bestäuber entwickeln passgenaue Formen aneinander angepasst.',
     'Blüten und ihre spezialisierten Bestäuber verändern sich über Generationen wechselseitig: Verlängert sich der Rüssel der Bestäuber, werden Blüten mit längeren Kronröhren begünstigt, und umgekehrt.'),
    ('29bb1387', 'Evolutive Entwicklung', 'didactic',
     'die jedoch nicht zu einem optimalem Design führt.',
     'die jedoch nicht zwangsläufig zu einem optimalen Design führt.'),
    ('2f452834', 'Variation und Diversität', 'beispiel',
     'Schneckenhäuser derselben Art unterscheiden sich in Farbe und Bänderung; Unterrichtsbezug: Artenvergleich, Erweiterung der Artenkenntnis.',
     'Schneckenhäuser derselben Art unterscheiden sich in Farbe und Bänderung.'),
    ('9b0602d2', 'Variation und Diversität', 'definition',
     'Innerhalb jeder Population unterscheiden sich Individuen in ihren Merkmalen – genetisch, phänotypisch und im Verhalten. Diese Variation ist die notwendige Voraussetzung für jede Form von Selektion und damit für Evolution überhaupt.',
     'Innerhalb jeder Population unterscheiden sich Individuen in ihren Merkmalen, genetisch und phänotypisch (z. B. in Körperbau, Physiologie und Verhalten). Diese Variation ist die notwendige Voraussetzung für jede Form von Selektion und damit für Evolution überhaupt.'),
    ('540fb04c', 'Gendrift', 'beispiel',
     'Ein zufälliges Ereignis (z. B. ein Sturm) dezimiert eine kleine Population und verändert dadurch zufällig die Allelhäufigkeiten der Überlebenden.',
     'In einer kleinen Population haben zufällig nicht alle Individuen gleich viele Nachkommen. Dadurch kann eine Allelvariante allein durch Zufall seltener werden oder ganz verschwinden, ohne dass sie einen Vor- oder Nachteil hat.'),
    ('830e81ed', 'Flaschenhalseffekt', 'beispiel',
     'Geparden weisen aufgrund eines historischen Flaschenhalses eine außergewöhnlich geringe genetische Vielfalt auf.',
     'Geparden haben eine außergewöhnlich geringe genetische Vielfalt. Genomstudien (Dobrynin et al. 2015) schließen auf zwei Flaschenhälse: einen vor mehr als 100 000 Jahren und einen vor etwa 11 000 bis 12 600 Jahren in Afrika, zur Zeit des Aussterbens vieler großer Säugetierarten am Ende der letzten Eiszeit.'),
    ('8560116a', 'Evolutionäre Entwicklungsbiologie (Evo-Devo)', 'definition',
     'Forschungsrichtung, die untersucht, wie Veränderungen in den genetischen Steuerungsprogrammen der individuellen Entwicklung (Ontogenese) zu evolutionären Veränderungen von Körperbauplänen führen.',
     'Forschungsrichtung, die untersucht, wie sich Prozesse der individuellen Entwicklung und evolutionäre Prozesse gegenseitig beeinflussen.'),
    ('57d09669', 'Energieentwertung', 'definition',
     'Bei jeder Energieumwandlung in einem lebenden System geht ein Teil der Energie als nicht mehr nutzbare Wärme verloren, weshalb Lebewesen auf eine ständige Energiezufuhr angewiesen sind.',
     'Lebewesen benötigen ständig Energie für lebenswichtige Prozesse und sind deshalb auf eine ständige Energiezufuhr angewiesen. Bei jeder Energieumwandlung in einem lebenden System geht außerdem ein Teil der Energie als nicht mehr nutzbare Wärme verloren.'),
    ('b03e28ae', 'negative Rückkopplung', 'definition',
     'Ein Regelkreis, bei dem die Abweichung eines Zustands von seinem Sollwert eine Gegenreaktion auslöst, welche die Abweichung verringert und den Zustand stabilisiert.',
     'Ein Regelkreis, bei dem die Abweichung eines Zustands von seinem Sollwert eine Gegenreaktion auslöst, welche die Abweichung verringert und den Zustand stabilisiert. Durch negative Rückkopplungen werden Fließgleichgewichte aufrechterhalten.'),
    ('cc429f89', 'Fließgleichgewicht', 'definition',
     'Ein für offene, lebende Systeme charakteristischer Zustand, in dem sich Zu- und Abfluss von Stoffen und Energie die Waage halten, sodass innere Zustandsgrößen konstant bleiben, obwohl fortlaufend Materie und Energie durch das System hindurchfließen — im Unterschied zu einem geschlossenen System, das einem statischen Gleichgewicht zustrebt.',
     'Ein für offene, lebende Systeme charakteristischer Zustand, der auch dynamisches Gleichgewicht genannt wird: Zu- und Abfluss von Stoffen und Energie halten sich die Waage, sodass innere Zustandsgrößen konstant bleiben, obwohl fortlaufend Materie und Energie durch das System hindurchfließen. Ein geschlossenes System strebt dagegen einem statischen Gleichgewicht zu.'),
    ('d9f7d27a', 'energetische Kopplung', 'definition',
     'Die Kopplung einer energieliefernden (exergonen) an eine energieverbrauchende (endergone) Reaktion, sodass die freigesetzte Energie den sonst nicht freiwillig ablaufenden Prozess antreibt.',
     'Die Kopplung einer energieliefernden (exergonen) an eine energieverbrauchende (endergone) Reaktion, sodass die freigesetzte Energie den sonst nicht von selbst ablaufenden Prozess antreibt.'),
    ('f78e6be2', 'Sexuelle Selektion', 'definition',
     'Eine Form der Selektion, bei der nicht das Überleben, sondern der Fortpflanzungserfolg entscheidet, welche Merkmale an die nächste Generation weitergegeben werden; sie wirkt über innergeschlechtliche Konkurrenz um Paarungspartner (z. B. Rivalenkämpfe) und über zwischengeschlechtliche Partnerwahl (z. B. auffällige Balzmerkmale).',
     'Selektion, die auf Unterschieden im Paarungserfolg beruht und damit beeinflusst, welche Merkmale an die nächste Generation weitergegeben werden; sie wirkt über innergeschlechtliche Konkurrenz um Paarungspartner (z. B. Rivalenkämpfe) und über zwischengeschlechtliche Partnerwahl (z. B. auffällige Balzmerkmale).'),
    ('f3e4a29e', 'Nischenkonstruktion', 'definition',
     'Organismen verändern aktiv ihre Umwelt und damit die Selektionsbedingungen für sich selbst und andere Arten.',
     'Organismen verändern aktiv ihre Umwelt und damit die Selektionsbedingungen für sich selbst, ihre Nachkommen und andere Arten.'),
    ('a2481d26', 'Lebensgeschichte / Life-History-Theorie', 'definition',
     'Theorie über die evolutionäre Optimierung des zeitlichen Ablaufs von Wachstum, Fortpflanzung und Alterung eines Organismus unter begrenzten Ressourcen (Trade-off zwischen Anzahl und Investition pro Nachkommen).',
     'Theorie über die evolutionäre Optimierung des zeitlichen Ablaufs von Wachstum, Fortpflanzung und Alterung eines Organismus unter begrenzten Ressourcen. Wegen der Ressourcenknappheit ergeben sich in jedem Entwicklungsstadium Trade-offs, z. B. zwischen der Anzahl und der Investition pro Nachkomme.'),
]

# New sub-concepts under "Steuerung und Regelung" (feedback 2a2a63c5). AI-drafted, to be checked by Susan.
NEW_CHILDREN = [
    ('Steuerung',
     'Ein Ablauf, bei dem eine Eingangsgröße eine Wirkung auslöst, ohne dass das Ergebnis zurückgemeldet und mit einem Sollwert verglichen wird (offener Wirkungsablauf, keine Rückkopplung).',
     'Beim Kniesehnenreflex löst der Reiz über den Reflexbogen eine Muskelkontraktion aus; das Ergebnis wird nicht mit einem Sollwert verglichen. Ein Lichtschalter schaltet die Lampe ein, ohne zu prüfen, ob es hell genug ist.'),
    ('Regelung',
     'Ein Ablauf, bei dem eine Größe (Istwert) gemessen, mit einem Sollwert verglichen und bei einer Abweichung durch eine Gegenreaktion korrigiert wird (geschlossener Wirkungskreis mit Rückkopplung).',
     'Ein Thermostat vergleicht die Raumtemperatur mit dem Sollwert und heizt bei Abweichung nach. Beim Menschen hält die Regelung die Körpertemperatur bei etwa 37 °C: Steigt sie, wird durch Schwitzen Wärme abgegeben.'),
]


def sq(s):
    return "'" + s.replace("'", "''") + "'"


SLUG_LIST = ', '.join(sq(s) for s in SLUGS)
PROJECTS = f"project_id IN (SELECT id FROM projects WHERE slug IN ({SLUG_LIST}))"
FALSCH3 = 'Ein Individuum kann sich im Laufe seines Lebens evolutiv anpassen (Lamarckismus)'


def statement(rows, label, kind, old, new):
    base = f"-- feedback {rows}: {label}\nUPDATE lpm_schema_elements SET "
    where = f"WHERE {PROJECTS} AND label = {sq(label)} AND "
    if kind == 'definition':
        return base + f"definition = {sq(new)}, updated_at = now()\n" + where + f"definition = {sq(old)};"
    if kind == 'didactic':
        return (base + f"didactic_definition = replace(didactic_definition, {sq(old)}, {sq(new)}), updated_at = now()\n"
                + where + f"didactic_definition LIKE {sq('%' + old + '%')};")
    if kind == 'beispiel':
        return (base + f"metadata = jsonb_set(metadata, '{{beispiel}}', to_jsonb({sq(new)}::text)), updated_at = now()\n"
                + where + f"metadata ->> 'beispiel' = {sq(old)};")
    if kind == 'misconception2':
        return (base + f"common_misconceptions = jsonb_set(common_misconceptions, '{{2,richtig}}', to_jsonb({sq(new)}::text)), updated_at = now()\n"
                + where + f"common_misconceptions -> 2 ->> 'falsch' = {sq(FALSCH3)} AND common_misconceptions -> 2 ->> 'richtig' = {sq(old)};")
    raise ValueError(kind)


def child_insert(label, definition, beispiel):
    meta = json.dumps({'beispiel': beispiel, 'language': 'de', 'source': 'susan_feedback_2026_10_30_ai_draft_unreviewed'}, ensure_ascii=False)
    return (f"-- feedback 2a2a63c5: new sub-concept {label} under Steuerung und Regelung\n"
            "INSERT INTO lpm_schema_elements (project_id, element_type, label, definition, parent_id, metadata, status)\n"
            f"SELECT p.id, 'concept', {sq(label)}, {sq(definition)}, par.id, {sq(meta)}::jsonb, 'accepted'\n"
            "FROM projects p JOIN lpm_schema_elements par ON par.project_id = p.id AND par.label = 'Steuerung und Regelung' AND par.parent_id IS NULL\n"
            f"WHERE p.slug IN ({SLUG_LIST})\n"
            f"  AND NOT EXISTS (SELECT 1 FROM lpm_schema_elements x WHERE x.project_id = p.id AND x.parent_id = par.id AND x.label = {sq(label)});")


HEADER = """-- 209: wording changes to the Basiskonzept concept texts, from Susan Hanisch's feedback of 2026-10-30
-- (rows 00bebea8, 19caa090, 1aac170f, 1fc022f5, 4ea1e2dd, 22613921, 29bb1387, 2a2a63c5, 2f452834, 9b0602d2, 540fb04c, 830e81ed,
-- 8560116a, 57d09669, b03e28ae, cc429f89, d9f7d27a, f78e6be2, f3e4a29e, a2481d26).
--
-- Each change follows her comment. Where she gave the wording, it is hers. Where she asked for content, the text is an AI draft that
-- she has not reviewed yet: the two new sub-concepts Steuerung and Regelung, the new Gendrift and Koevolution examples, the
-- Flaschenhals example for the cheetah (two bottlenecks, after Dobrynin et al. 2015, Genome Biology), and the Life-History sentence.
--
-- Each update carries the exact old text and does nothing to a record that no longer says it, so running it twice changes nothing.
-- The same concept texts exist in the live space and its sandbox copy; both are changed. The project "evomentor" words them differently and is left alone.
SET search_path = public, extensions;

"""


def build():
    parts = [statement(*e) for e in EDITS] + [child_insert(*c) for c in NEW_CHILDREN]
    return HEADER + '\n\n'.join(parts) + '\n'


def check(path):
    data = json.load(open(path, encoding='utf-8'))
    bad = 0
    for rows, label, kind, old, new in EDITS:
        for slug in SLUGS:
            els = [e for e in data[slug] if e['label'] == label]
            if kind == 'definition':
                hit = [e for e in els if e['definition'] == old]
            elif kind == 'didactic':
                hit = [e for e in els if old in (e.get('didactic_definition') or '')]
            elif kind == 'beispiel':
                hit = [e for e in els if (e['metadata'] or {}).get('beispiel') == old]
            else:
                hit = [e for e in els if (e.get('common_misconceptions') or [None, None, {}])[2].get('falsch') == FALSCH3
                       and e['common_misconceptions'][2].get('richtig') == old]
            expect = 2 if label == 'Fließgleichgewicht' and slug != 'evomentor' else None
            ok = len(hit) >= 1 and (expect is None or len(hit) == expect)
            if not ok:
                bad += 1
            print(('ok  ' if ok else 'FAIL'), rows.split()[0], slug, label, len(hit))
    for label, _, _ in NEW_CHILDREN:
        for slug in SLUGS:
            par = [e for e in data[slug] if e['label'] == 'Steuerung und Regelung' and not e['parent_id']]
            print('ok  ' if len(par) == 1 else 'FAIL', 'parent for', label, slug, len(par))
            bad += 0 if len(par) == 1 else 1
    print('guards that do not match:', bad)
    return bad


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out')
    ap.add_argument('--check')
    a = ap.parse_args()
    if a.check:
        raise SystemExit(1 if check(a.check) else 0)
    open(a.out, 'w', encoding='utf-8', newline='\n').write(build())
    print('written', a.out)
