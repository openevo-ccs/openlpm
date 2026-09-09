import { useState } from 'react'

export function TabPanels({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div className="tabs">
        {tabs.map((tab, i) => (
          <button key={tab.label} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
            {tab.label}
          </button>
        ))}
      </div>
      {tabs[active].content}
    </div>
  )
}
