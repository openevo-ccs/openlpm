import { useState } from 'react'
import { Info } from 'lucide-react'
import { TIPS } from '@/lib/teachingbase-review-strings'

// A small info icon with a plain explanation. It works by pointing, by keyboard and by tapping (the text opens under the icon).

export function InfoTip({ term, lang }: { term: string; lang: 'en' | 'de' }) {
  const [open, setOpen] = useState(false)
  const text = TIPS[lang][term]
  if (!text) return null
  return (
    <span className="tb-tip">
      <button
        type="button"
        className="tb-tip-btn"
        aria-label={text}
        aria-expanded={open}
        title={text}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onBlur={() => setOpen(false)}
      >
        <Info size={16} />
      </button>
      {open && <span role="tooltip" className="tb-tip-bubble">{text}</span>}
    </span>
  )
}
