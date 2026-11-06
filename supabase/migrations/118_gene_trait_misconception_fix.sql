SET search_path = public, extensions;

-- Real feedback 0eafd816 (Susan Hanisch, 2026-10-09): "problematic framing:
-- this does not resolve the misconception of one gene = one trait, because
-- you do not refer to the issue that most traits are also polygenic or
-- that one gene is involved in many traits (pleiotropy), or the issue of
-- gene-environment interactions." The item is
-- "Proteinbiosynthese: Transkription und Translation" -- its existing
-- moegliche_fehlvorstellungen text only addressed the indirect gene ->
-- protein -> trait pathway, not the three concepts Susan named. Her
-- comment already specifies exactly what's missing -- this applies that,
-- it does not ask her to also write the prose herself.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,moegliche_fehlvorstellungen}',
  '"Schülerinnen und Schüler setzen ein Gen häufig unmittelbar mit einem Merkmal gleich (\"ein Gen = ein Merkmal\"). Das ist in mehrfacher Hinsicht zu einfach gedacht: Der Weg vom Gen über das Protein zum Merkmal verläuft über mehrere Zwischenschritte; die meisten Merkmale sind zudem polygen, also von mehreren Genen gemeinsam beeinflusst; umgekehrt wirkt ein einzelnes Gen oft auf mehrere Merkmale zugleich (Pleiotropie); und wie ein Merkmal tatsächlich ausgeprägt wird, hängt häufig zusätzlich von Umwelteinflüssen ab (Gen-Umwelt-Interaktion)."'::jsonb
)
WHERE id = 'c4eb74a3-b5e1-5d68-8763-c1dec3ac36ee';
