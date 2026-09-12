// Client for FWU-DE's real public Lehrplan-Ontologie SPARQL endpoint,
// relayed through the sparql-proxy Edge Function (that endpoint sends no
// CORS headers, so the browser can't call it directly -- see that
// function's own comment).
//
// The query patterns here are ported directly from EvoMentor's own
// importers/fwu_lehrplan_importer.py, which did the real research to find
// them: the ontology's own "hat Teil" (has-part) property returns zero
// results for real documents (confirmed dead end, not a bug to route
// around), but the shared BFO upper-ontology's transitive "has part"
// property, filtered to elements tagged with a competency- or
// content-description function, does return real Lernziel/Lerninhalt text.
// Reusing that exact pattern here rather than re-deriving it.
import { createClient } from '@/lib/supabase/client'

const LP = 'https://w3id.org/lehrplan/ontology/'
const BFO = 'http://purl.obolibrary.org/obo/'
const CLASS_LEHRPLAN = `${LP}LP_0000438`
const PROP_VON_BUNDESLAND = `${LP}LP_0000029`
const PROP_HAT_FUNKTION = `${LP}LP_0000483`
const PROP_HAS_PART_BFO = `${BFO}BFO_0000051`
const FUNC_KOMPETENZBESCHREIBUNG = `${LP}LP_0000479`
const FUNC_LERNINHALTSBESCHREIBUNG = `${LP}LP_0000480`

// Bundesländer FWU-DE's live endpoint actually has curriculum data loaded
// for, confirmed directly (not assumed) -- Thuringia has none upstream,
// which is why its own project uses a different, hand-authored path instead
// of this importer.
export const FWU_LAENDER: { label: string; uri: string; jurisdiction: string }[] = [
  { label: 'Sachsen', uri: `${LP}LP_3000047`, jurisdiction: 'DE-SN' },
  { label: 'Bayern', uri: `${LP}LP_3000051`, jurisdiction: 'DE-BY' },
  { label: 'Brandenburg', uri: `${LP}LP_3000041`, jurisdiction: 'DE-BB' },
  { label: 'Rheinland-Pfalz', uri: `${LP}LP_3000046`, jurisdiction: 'DE-RP' },
]

export interface FwuDocument {
  uri: string
  title: string
}

export interface FwuCandidate {
  documentUri: string
  documentTitle: string
  uri: string
  label: string
  functionUri: string
}

async function sparqlQuery(query: string): Promise<Record<string, { value: string }>[]> {
  const supabase = createClient()
  const { data, error } = await supabase.functions.invoke('sparql-proxy', { body: { query } })
  if (error) throw new Error(`SPARQL proxy error: ${error.message}`)
  return (data?.results?.bindings ?? []) as Record<string, { value: string }>[]
}

export async function discoverDocuments(landUri: string, subjectFilter: string): Promise<FwuDocument[]> {
  const query = `
    PREFIX lp: <${LP}>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?Lehrplan ?Titel
    WHERE {
      ?Lehrplan a <${CLASS_LEHRPLAN}> .
      ?Lehrplan <${PROP_VON_BUNDESLAND}> <${landUri}> .
      ?Lehrplan rdfs:label ?Titel .
      FILTER(CONTAINS(LCASE(STR(?Titel)), "${subjectFilter.toLowerCase().replace(/"/g, '')}"))
    }
  `
  const bindings = await sparqlQuery(query)
  const seen = new Set<string>()
  const docs: FwuDocument[] = []
  for (const b of bindings) {
    const uri = b.Lehrplan.value
    if (seen.has(uri)) continue
    seen.add(uri)
    docs.push({ uri, title: b.Titel.value })
  }
  return docs
}

export async function discoverFineGrainedContent(doc: FwuDocument): Promise<FwuCandidate[]> {
  const query = `
    PREFIX lp: <${LP}>
    PREFIX bfo: <${BFO}>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?element ?elementLabel ?func WHERE {
      <${doc.uri}> <${PROP_HAS_PART_BFO}>+ ?element .
      ?element <${PROP_HAT_FUNKTION}> ?func .
      FILTER(?func = <${FUNC_KOMPETENZBESCHREIBUNG}> || ?func = <${FUNC_LERNINHALTSBESCHREIBUNG}>)
      ?element rdfs:label ?elementLabel .
    }
  `
  const bindings = await sparqlQuery(query)
  const seen = new Set<string>()
  const items: FwuCandidate[] = []
  for (const row of bindings) {
    const uri = row.element.value
    if (seen.has(uri)) continue
    seen.add(uri)
    items.push({
      documentUri: doc.uri,
      documentTitle: doc.title,
      uri,
      label: row.elementLabel.value,
      functionUri: row.func.value,
    })
  }
  return items
}
