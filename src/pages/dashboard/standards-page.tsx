import { useOutletContext } from 'react-router-dom'
import { Info } from 'lucide-react'
import { FrameworkTree } from '@/components/framework-tree'
import { TabPanels } from '@/components/tab-panels'
import { Chip } from '@/components/chip'
import type { ProjectOutletContext } from './project-layout'
import basiskonzepteFramework from '@/data/frameworks/basiskonzepte-taxonomie-biologiedidaktik-de-v1.json'
import thuringiaDiff from '@/data/frameworks/thuringia-biologie-gym-2024-2026-diff.json'

// Preview of RFC 0003 (proposals/0003-frameworks-and-versioned-standards.md,
// status: Proposed) -- renders the two files staged directly from real
// source material (a hand-authored Basiskonzepte taxonomy CSV; a 2024->2026
// Thuringia Lehrplan diff) rather than fabricated fixtures, so the actual
// data model proposal can be evaluated against real content before its
// migration is written. Reads static repo files, not project-scoped DB
// tables -- those don't exist until RFC 0003 is reviewed and built.

export default function StandardsPage() {
  useOutletContext<ProjectOutletContext>()

  return (
    <div>
      <h1>Standards &amp; frameworks</h1>
      <p className="muted" style={{ marginBottom: 12 }}>
        Cross-cutting conceptual frameworks and versioned curriculum standards, with real version comparison.
      </p>

      <div className="notice">
        <Info size={14} />
        Preview of a proposed data model (RFC 0003, not yet reviewed) — this renders two files staged directly
        from real source material this session, not project-scoped database rows yet.
      </div>

      <TabPanels
        tabs={[
          {
            label: 'Basiskonzepte Taxonomie',
            content: (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3>{basiskonzepteFramework.label}</h3>
                  <Chip status="draft">project-local, unreviewed</Chip>
                </div>
                <p className="muted" style={{ marginBottom: 12 }}>{basiskonzepteFramework.source}</p>
                <FrameworkTree tags={basiskonzepteFramework.tags} />
              </div>
            ),
          },
          {
            label: `${thuringiaDiff.fromVersion.label} → ${thuringiaDiff.toVersion.label}`,
            content: (
              <div style={{ marginTop: 12 }}>
                {thuringiaDiff.structuralChanges.map((change) => (
                  <div key={change.id} className="card" style={{ marginBottom: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>Structural change</strong>
                      <Chip status={change.changeType} />
                    </div>
                    <p style={{ marginTop: 6 }}>{change.description}</p>
                    <p className="muted" style={{ marginTop: 6 }}>{change.note}</p>
                  </div>
                ))}

                <div className="card">
                  <h3>Item-level changes ({thuringiaDiff.summary.totalItemChanges})</h3>
                  {thuringiaDiff.itemChanges.map((change) => (
                    <div key={change.id} style={{ marginTop: 12 }}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="muted">Klassenstufe {change.gradeBand}</span>
                        <Chip status={change.changeType} />
                      </div>
                      <div className="diff-row">
                        <span className={change.text2024 ? 'diff-old' : 'diff-empty'}>
                          {change.text2024 ?? '(no 2024 equivalent)'}
                        </span>
                        <span>{change.text2026}</span>
                      </div>
                      {change.note && <p className="muted">{change.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
