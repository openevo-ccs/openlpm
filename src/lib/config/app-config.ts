// Simple configuration for OpenLPM

export interface AppConfig {
  appName: string
  appShortName: string
  tagline: string
  description: string
  primaryColor: string
}

export const defaultConfig: AppConfig = {
  appName: 'OpenLPM',
  appShortName: 'OpenLPM',
  tagline: 'Collaborative Learning Progression Management',
  description: 'A cost-free, scientifically rigorous platform for collaborative development of learning progressions',
  primaryColor: '#006c66' // OpenEvo brand teal (--brand-teal / overridden --series-a in globals.css)
}

export const config: AppConfig = defaultConfig

export function getConfig(): AppConfig {
  return config
}