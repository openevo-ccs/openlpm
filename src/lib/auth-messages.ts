// Plain-language sign-in and sign-up messages, German first and English second,
// because the login page is read by seminar students in Jena and by lab
// collaborators. Supabase's own texts ("Invalid login credentials") say what went
// wrong in the system's words and give no next step. Added 2026-11-18 after three
// students of the Jena seminar reported that sign-in failed even though their
// details were correct.

export type AuthProblem =
  | 'wrong_details'
  | 'not_confirmed'
  | 'too_many_tries'
  | 'already_registered'
  | 'weak_password'
  | 'no_connection'
  | 'other'

type ErrorLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined

/** Sorts a Supabase auth error into a problem the page knows how to explain. */
export function classifyAuthError(error: ErrorLike): AuthProblem {
  if (!error) return 'other'
  const code = error.code ?? ''
  const msg = (error.message ?? '').toLowerCase()
  if (code === 'email_not_confirmed' || /email not confirmed/.test(msg)) return 'not_confirmed'
  if (code === 'invalid_credentials' || /invalid login credentials/.test(msg)) return 'wrong_details'
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    error.status === 429 ||
    /rate limit|too many requests|after \d+ seconds?/.test(msg)
  )
    return 'too_many_tries'
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already been registered/.test(msg))
    return 'already_registered'
  if (code === 'weak_password' || /password should be|weak password/.test(msg)) return 'weak_password'
  if (error.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed/.test(msg)) return 'no_connection'
  return 'other'
}

const MESSAGES: Record<AuthProblem, (raw: string) => string> = {
  wrong_details: () =>
    'E-Mail-Adresse oder Passwort stimmen nicht. Prüfe die Schreibweise (beim Passwort zählen Groß- und Kleinschreibung). ' +
    'Hast du dich mit GitHub angemeldet oder ein anderes Passwort gesetzt? Dann hilft „Forgot password?“ unten, es setzt ein neues.' +
    '\n\nEmail or password does not match. Check the spelling (passwords are case-sensitive). If you used GitHub, or set a different password, use “Forgot password?” below to set a new one.',
  not_confirmed: () =>
    'Deine E-Mail-Adresse ist noch nicht bestätigt. Öffne die Bestätigungs-E-Mail (schau auch im Spam-Ordner) oder lass sie dir neu schicken.' +
    '\n\nYour email address is not confirmed yet. Open the confirmation email (check spam too) or send it again.',
  too_many_tries: () =>
    'Zu viele Versuche in kurzer Zeit. Warte etwa eine Minute und versuche es dann noch einmal. Das passiert, wenn viele Personen im selben Netz gleichzeitig anmelden.' +
    '\n\nToo many attempts in a short time. Wait about a minute and try again. This can happen when many people sign in from the same network at once.',
  already_registered: () =>
    'Zu dieser E-Mail-Adresse gibt es schon ein Konto. Melde dich an. Wenn du das Passwort nicht mehr weißt, nimm „Forgot password?“.' +
    '\n\nThere is already an account for this email address. Sign in, or use “Forgot password?” if you do not remember the password.',
  weak_password: () =>
    'Das Passwort ist zu einfach oder zu kurz. Nimm mindestens 6 Zeichen.' + '\n\nThe password is too simple or too short. Use at least 6 characters.',
  no_connection: () =>
    'Keine Verbindung zum Server. Prüfe dein Netz und versuche es noch einmal.' + '\n\nNo connection to the server. Check your network and try again.',
  other: (raw) => `Das hat nicht geklappt. Versuche es noch einmal. (${raw || 'unbekannter Fehler'})\n\nThat did not work. Please try again.`,
}

export function explainAuthError(error: ErrorLike): { problem: AuthProblem; text: string } {
  const problem = classifyAuthError(error)
  return { problem, text: MESSAGES[problem](error?.message ?? '') }
}

export const SIGNUP_ALREADY_REGISTERED_TEXT = MESSAGES.already_registered('')

/**
 * With email confirmation switched on, Supabase answers a sign-up for an address that
 * already has an account with a success and no error, sends no email, and returns a user
 * with an empty identities list. Without this check the person waits for an email that
 * never comes.
 */
export function signUpHitExistingAccount(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0
}
