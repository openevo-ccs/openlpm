// Relays a SPARQL SELECT query to FWU-DE's live public Lehrplan-Ontologie
// endpoint (sparql.mem.edufeed.org) and returns its JSON response with CORS
// headers attached.
//
// Why this exists at all: that endpoint is real, public, and needs no key --
// but (checked directly, curl -D -) it sends no Access-Control-Allow-Origin
// header, so a browser blocks a direct fetch() to it from openlpm's own
// origin. This function does nothing except add that header; the actual
// query-building logic (which Land, which document pattern, the BFO
// transitive has-part + function-filter workaround FWU's own reasoning
// doesn't support) lives in src/lib/importers/fwuLehrplan.ts on the client,
// not here -- this stays a dumb, generic relay so it never needs redeploying
// when that logic changes.
//
// Only forwards read-only SPARQL SELECT queries to a single fixed, public
// endpoint -- there is nothing here for a caller to reach beyond that one
// external read.

const SPARQL_ENDPOINT = 'https://sparql.mem.edufeed.org/sparql'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Use POST with a JSON body: { "query": "<SPARQL SELECT>" }' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let query: string
  try {
    const body = await req.json()
    query = String(body.query ?? '')
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  if (!query.trim().toUpperCase().startsWith('PREFIX') && !query.trim().toUpperCase().startsWith('SELECT')) {
    return new Response(JSON.stringify({ error: 'Only SPARQL SELECT queries are relayed.' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const upstream = await fetch(`${SPARQL_ENDPOINT}?${new URLSearchParams({ query })}`, {
      headers: { Accept: 'application/sparql-results+json' },
    })
    const text = await upstream.text()
    // The SPARQL results body is valid JSON either way -- but the Supabase
    // JS client's functions.invoke() only auto-parses a response body when
    // Content-Type is EXACTLY 'application/json' (strict equality, checked
    // directly in its source); anything else, including the real SPARQL
    // media type 'application/sparql-results+json', falls back to returning
    // the raw text. That silently broke every caller here -- `data` was a
    // string, `data?.results?.bindings` was always undefined, and every
    // search quietly came back empty with no error to notice.
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `Upstream SPARQL request failed: ${err}` }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
