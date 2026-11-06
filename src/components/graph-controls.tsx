import { useCallback, useState } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { DEFAULT_GRAPH_SETTINGS, loadGraphSettings, saveGraphSettings, type GraphEdgeMode, type GraphViewSettings } from '@/lib/graph-standards'

// The one control panel every OpenLPM graph shows (rule 6 of the graph
// standards). A graph passes which groups of controls make sense for it, so
// a graph with few links per item can leave out the connection choices.
// Wording comes in German and English; the student pages use German.

type Lang = 'de' | 'en'

const TEXT: Record<Lang, Record<string, string>> = {
  de: {
    connections: 'Verbindungen',
    tree: 'Nur Hauptverbindung',
    bundled: 'Gebündelt',
    all: 'Alle',
    labels: 'Beschriftung',
    few: 'Ohne Überlappung',
    allLabels: 'Alle',
    layout: 'Anordnung',
    fixed: 'Spalten',
    physics: 'Frei verteilt',
    lines: 'Linien',
    spacing: 'Abstand (frei verteilt)',
    zoomOut: 'Verkleinern',
    fit: 'Einpassen',
    zoomIn: 'Vergrößern',
    reset: 'Zurücksetzen',
    treeHint: 'Jedes Lernziel zeigt nur seine stärkste Verbindung.',
    bundledHint: 'Hauptverbindungen, dazu dicke Bögen zwischen den Basiskonzepten mit der Anzahl gemeinsamer Lernziele. Weitere Verbindungen eines Lernziels erscheinen, wenn man darauf zeigt.',
    allHint: 'Jede Verbindung wird gezeichnet. Das wird schnell unübersichtlich.',
    fixedHint: 'Feste, immer gleiche Anordnung.',
    physicsHint: 'Die Punkte ordnen sich selbst an, ähnlich wie Magnete, um die festen Basiskonzepte herum. Die feste Anordnung bleibt die Standardeinstellung.',
  },
  en: {
    connections: 'Connections',
    tree: 'Main link only',
    bundled: 'Bundled',
    all: 'All',
    labels: 'Labels',
    few: 'No overlap',
    allLabels: 'All',
    layout: 'Layout',
    fixed: 'Fixed',
    physics: 'Free spread',
    lines: 'Lines',
    spacing: 'Spacing (free spread)',
    zoomOut: 'Zoom out',
    fit: 'Fit to screen',
    zoomIn: 'Zoom in',
    reset: 'Reset',
    treeHint: 'Each item shows only its strongest link.',
    bundledHint: 'Main links, plus thick arcs between the big groups with the number of items they share. An item\'s other links appear when you point at it.',
    allHint: 'Every link is drawn. This gets crowded quickly.',
    fixedHint: 'A fixed layout that is always the same.',
    physicsHint: 'Nodes arrange themselves around the pinned groups.',
  },
}

/** Remembers a graph's settings in this browser, per graph. */
export function useGraphSettings(
  graphId: string,
  defaults: GraphViewSettings = DEFAULT_GRAPH_SETTINGS,
): [GraphViewSettings, (patch: Partial<GraphViewSettings>) => void, () => void] {
  const [settings, setSettings] = useState<GraphViewSettings>(() => loadGraphSettings(graphId, defaults))
  const update = useCallback((patch: Partial<GraphViewSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveGraphSettings(graphId, next)
      return next
    })
  }, [graphId])
  const reset = useCallback(() => {
    const fresh = { ...defaults }
    saveGraphSettings(graphId, fresh)
    setSettings(fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId, defaults.edges, defaults.labels, defaults.layout, defaults.lineStrength, defaults.spacing])
  return [settings, update, reset]
}

export interface GraphControlsProps {
  settings: GraphViewSettings
  onChange: (patch: Partial<GraphViewSettings>) => void
  onReset: () => void
  lang?: Lang
  /** Show the choice between main link, bundled and all links. Leave off for graphs with few links per item. */
  showConnections?: boolean
  /** Which connection modes this graph offers (default all three). A flat list with no groups has nothing to bundle. */
  edgeModes?: GraphEdgeMode[]
  /** Graph-specific wording for a connection mode or the fixed layout, when the standard wording does not fit. */
  wording?: Partial<Record<'tree' | 'bundled' | 'all' | 'fixed', { label: string; hint?: string }>>
  showLayout?: boolean
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFit?: () => void
}

export function GraphControls({ settings, onChange, onReset, lang = 'de', showConnections = true, edgeModes = ['tree', 'bundled', 'all'], wording = {}, showLayout = true, onZoomIn, onZoomOut, onFit }: GraphControlsProps) {
  const t = TEXT[lang]
  const word = (key: 'tree' | 'bundled' | 'all' | 'fixed', fallbackLabel: string, fallbackHint: string) => ({
    label: wording[key]?.label ?? fallbackLabel,
    hint: wording[key]?.hint ?? fallbackHint,
  })
  const modeText = { tree: word('tree', t.tree, t.treeHint), bundled: word('bundled', t.bundled, t.bundledHint), all: word('all', t.all, t.allHint) }
  const fixedText = word('fixed', t.fixed, t.fixedHint)
  const chip = (active: boolean) => `chip-btn${active ? ' active' : ''}`
  const physics = settings.layout === 'physics'
  return (
    <div className="netz-controls" role="group" aria-label={lang === 'de' ? 'Darstellung des Netzes' : 'Graph display'}>
      {showConnections && (
        <div className="netz-control-group">
          <span className="muted" style={{ fontSize: 11 }}>{t.connections}:</span>
          {edgeModes.map((mode) => (
            <button key={mode} className={chip(settings.edges === mode)} title={modeText[mode].hint} onClick={() => onChange({ edges: mode })}>{modeText[mode].label}</button>
          ))}
        </div>
      )}
      <div className="netz-control-group">
        <span className="muted" style={{ fontSize: 11 }}>{t.labels}:</span>
        <button className={chip(settings.labels === 'few')} onClick={() => onChange({ labels: 'few' })}>{t.few}</button>
        <button className={chip(settings.labels === 'all')} onClick={() => onChange({ labels: 'all' })}>{t.allLabels}</button>
      </div>
      {showLayout && (
        <div className="netz-control-group">
          <span className="muted" style={{ fontSize: 11 }}>{t.layout}:</span>
          <button className={chip(!physics)} title={fixedText.hint} onClick={() => onChange({ layout: 'fixed' })}>{fixedText.label}</button>
          <button className={chip(physics)} title={t.physicsHint} onClick={() => onChange({ layout: 'physics' })}>{t.physics}</button>
        </div>
      )}
      <div className="netz-control-group">
        <label className="muted" style={{ fontSize: 11 }}>
          {t.lines}{' '}
          <input type="range" min={10} max={100} value={settings.lineStrength} onChange={(e) => onChange({ lineStrength: Number(e.target.value) })} style={{ verticalAlign: 'middle', width: 80 }} />
        </label>
        {showLayout && (
          <label className="muted" style={{ fontSize: 11, opacity: physics ? 1 : 0.45 }}>
            {t.spacing}{' '}
            <input type="range" min={0} max={100} value={settings.spacing} disabled={!physics} onChange={(e) => onChange({ spacing: Number(e.target.value) })} style={{ verticalAlign: 'middle', width: 80 }} />
          </label>
        )}
        <button className="btn btn-mini" onClick={onReset}>{t.reset}</button>
      </div>
      {(onZoomIn || onZoomOut || onFit) && (
        <div className="netz-control-group">
          {onZoomOut && <button className="btn btn-mini" aria-label={t.zoomOut} onClick={onZoomOut}><ZoomOut size={13} /></button>}
          {onFit && <button className="btn btn-mini" aria-label={t.fit} onClick={onFit}><Maximize2 size={13} /></button>}
          {onZoomIn && <button className="btn btn-mini" aria-label={t.zoomIn} onClick={onZoomIn}><ZoomIn size={13} /></button>}
        </div>
      )}
    </div>
  )
}
