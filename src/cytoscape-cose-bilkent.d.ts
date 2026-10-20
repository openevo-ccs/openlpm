// No @types package exists for this extension (checked npm, 404) -- same
// shape as cytoscape-dagre's own real-world usage in this codebase
// (concepts-page.tsx, strands-page.tsx), a cytoscape.use()-registered
// layout extension with no exported API beyond the plugin function itself.
declare module 'cytoscape-cose-bilkent' {
  import type { Ext } from 'cytoscape'
  const ext: Ext
  export default ext
}
