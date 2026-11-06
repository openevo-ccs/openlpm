SET search_path = public, extensions;

-- Real feedback e09987a0 (Susan Hanisch, 2026-10-09): "here is an example
-- where the methods are not sufficiently distinct: 'analogien und
-- vergleiche' lists the same kind of approach as 'konzeptuelles lernen'.
-- in general, 'konzeptuelles Lernen' may need to be distinct by proposing
-- methods that specifically help to strengthen the transferable and
-- deeper understanding of relevant basiskonzepte."
--
-- Her named example: "Samenpflanzen vergleichen: Vielfalt gleicher
-- Grundaufbau". Its rang-3 "Konzeptuelles Lernen" entry (building a table
-- of the same four basic organs across species) was really just a second
-- comparison exercise -- the same underlying move as rang-1's "Analogien
-- und Vergleiche" entry, just recorded differently. Applying her own
-- stated principle: a genuine Konzeptuelles-Lernen activity here should
-- make the student articulate the GENERAL principle behind the table
-- (shared structure despite surface diversity) and transfer it to a new
-- case, which is what actually strengthens transferable understanding of
-- the Struktur-und-Funktion Basiskonzept rather than repeating the
-- comparison itself.
--
-- This is the one concrete example Susan reviewed and flagged. She named
-- a real, broader pattern ("in general... may need to be distinct"), not
-- just this one row -- left untouched here deliberately, the same way the
-- 91-row "(bioethische) Diskussion" filler pattern (migration 116) was
-- left for its own dedicated review rather than a blind bulk rewrite.
UPDATE lpm_data_objects
SET content = jsonb_set(
  content,
  '{didaktische_strategien,top3_methoden,2,beschreibung}',
  '"Das übergeordnete Prinzip aus der Tabelle in eigenen Worten formulieren (\"gleicher Grundaufbau trotz vielfältiger Erscheinungsform\") und auf ein neues Beispiel übertragen, z. B. Wirbeltierskelette -- macht den Transfer auf das Basiskonzept Struktur und Funktion über dieses eine Thema hinaus sichtbar, statt die Vergleichsübung zu wiederholen."'::jsonb
)
WHERE id = 'd0d80b71-0e1f-576c-a3ad-a9600c4c5e40'
  AND content->'didaktische_strategien'->'top3_methoden'->2->>'methode' = 'Konzeptuelles Lernen';
