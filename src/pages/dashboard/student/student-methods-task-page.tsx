// "Aufgabe 2: Didaktische Methoden" (Susan Hanisch, 2026-11-12, feedback 1acd80a7: "under Meine Arbeit, create a page
// 'Aufgabe 2: Didaktische Methoden' but make it invisible for now in this view").
//
// The page exists so it can be filled step by step. Students do not see it yet: it has no menu entry (see SEMINAR_TASKS in
// student-nav.tsx) and its address is not in JENA_STUDENT_PATHS (project-layout.tsx), so a student who types the address is
// sent to the start page. Owners, maintainers and admins can open it by address:
// /dashboard/<space>/aufgabe2
export default function StudentMethodsTaskPage() {
  return (
    <div className="student-page">
      <h1 style={{ marginBottom: 4 }}>Aufgabe 2: Didaktische Methoden</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: 680 }}>
        Diese Aufgabe wird noch vorbereitet.
      </p>
      <p style={{ maxWidth: 680 }}>
        Die Seite ist für Studierende noch nicht sichtbar. Sie hat keinen Menüpunkt, und wer ihre Adresse eintippt, landet auf der Startseite.
        Sie kann nur sehen, wer das Projekt leitet oder betreut. Sobald die Aufgabe fertig ist, wird der Menüpunkt unter „Meine Arbeit“ freigeschaltet.
      </p>
    </div>
  )
}
