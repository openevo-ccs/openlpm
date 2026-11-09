// Shared rule for every script that prints people's own words (feedback, student work, saved
// prompts, notebooks) where an AI assistant such as a Claude Code session will read the output.
//
// A person can opt out of processing by outside AI services (migration 238, table
// user_privacy_settings, switch on the Profile page, privacy statement section 6). The scripts
// have to honour that, because they read with the service key, which sees every row.
//
//   1. Load the opted-out ids once:      const optedOut = await loadOptedOutUserIds(url, key)
//   2. Before printing a row's text:     if (optedOut.has(row.user_id)) print WITHHELD instead
//
// Counts, dates and other numbers that cannot be traced to a person may still be printed.
// Names and email addresses of opted-out people are withheld too, since they identify the person.
//
// This fails closed. If the opt-out list cannot be read for any reason other than the table not
// existing yet, the script stops with a message and prints nothing, because printing would break
// the promise made to students.

export const WITHHELD = '[withheld: the author opted out of AI processing]'

export async function loadOptedOutUserIds(supabaseUrl, serviceKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/user_privacy_settings?select=user_id&ai_processing_opt_out=eq.true`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  )
  if (!res.ok) {
    const body = await res.text()
    // The table is created by migration 238. Before that migration is pushed nobody can have opted
    // out (the Profile switch cannot save without the table), so a missing table means an empty list.
    if (res.status === 404 && body.includes('user_privacy_settings')) return new Set()
    throw new Error(
      `Could not read the AI opt-out list (${res.status}). Nothing is printed, so no opted-out person's text can leak.`,
    )
  }
  const rows = await res.json()
  return new Set(rows.map((r) => r.user_id))
}

/** True when a storage path such as "<user id>/<file>.jpg" belongs to an opted-out person. */
export function storagePathIsOptedOut(path, optedOutIds) {
  const owner = String(path).split('/')[0]
  return optedOutIds.has(owner)
}
