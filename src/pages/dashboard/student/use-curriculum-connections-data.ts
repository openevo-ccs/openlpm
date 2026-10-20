import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { ProjectOutletContext } from '../project-layout'
import { listTopics, type TopicListItem } from '@/lib/supabase/curriculum'
import {
  listContentLinksForDataObjects,
  listRepositoryRecordsForRegionSlugs,
  type DataObjectLinkWithRecord,
  type RepositoryRecordRow,
} from '@/lib/supabase/curriculum-repository'
import {
  KNOWN_COMPARISON_PAIRS,
  getProjectComparisonProfile,
  listComparativeLinksBetweenProjects,
  listDivergenceCoverage,
  type ComparativeLinkWithTitles,
  type DivergenceCoverageRow,
  type ProjectComparisonProfile,
} from '@/lib/supabase/comparative-analysis'
import { getCurriculumConnectionsViewConfig } from '@/lib/student-view-templates'

// Shared by all 4 real pages these 4 custom views now use (Overview,
// Network, Comparison, Report) -- one real data-fetching pass instead of
// four near-duplicate copies of the same effects. Split out of
// curriculum-connections-page.tsx on 2026-10-20 when that single page grew
// into a real multi-page sidebar nav per that day's feedback ("much more
// strategic use of custom side bar menus").
export function useCurriculumConnectionsData() {
  const { project, defaultBranchId, role, supabase, templateId } = useOutletContext<ProjectOutletContext>()
  const config = getCurriculumConnectionsViewConfig(templateId)
  const canEdit = role !== 'viewer' && role !== 'reviewer'

  const [topics, setTopics] = useState<TopicListItem[] | null>(null)
  const [linksByObject, setLinksByObject] = useState<Record<string, DataObjectLinkWithRecord[]>>({})
  const [regionRecords, setRegionRecords] = useState<RepositoryRecordRow[]>([])
  const [profile, setProfile] = useState<ProjectComparisonProfile | null>(null)
  const [compareProfile, setCompareProfile] = useState<ProjectComparisonProfile | null>(null)
  const [compareName, setCompareName] = useState('')
  const [compareProjectId, setCompareProjectId] = useState<string | null>(null)
  const [comparativeLinks, setComparativeLinks] = useState<ComparativeLinkWithTitles[] | null>(null)
  const [coverage, setCoverage] = useState<DivergenceCoverageRow[]>([])
  const [refreshToken, setRefreshToken] = useState(0)
  const refresh = () => setRefreshToken((x) => x + 1)

  useEffect(() => {
    setTopics(null)
    listTopics(supabase, project.id, defaultBranchId).then(setTopics)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, project.id, defaultBranchId])

  useEffect(() => {
    if (!config) return
    listRepositoryRecordsForRegionSlugs(supabase, config.regionSlugs).then(setRegionRecords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, templateId])

  useEffect(() => {
    if (!topics || topics.length === 0) return
    listContentLinksForDataObjects(supabase, topics.map((tp) => tp.id)).then(setLinksByObject)
  }, [supabase, topics, refreshToken])

  useEffect(() => {
    getProjectComparisonProfile(supabase, project.id).then(setProfile)
    listDivergenceCoverage(supabase, project.id).then(setCoverage)
  }, [supabase, project.id, refreshToken])

  useEffect(() => {
    const compareSlug = KNOWN_COMPARISON_PAIRS[project.slug]
    if (!compareSlug) return
    supabase.from('projects').select('id,name').eq('slug', compareSlug).maybeSingle().then(({ data }) => {
      if (data) { setCompareProjectId(data.id); setCompareName(data.name) }
    })
  }, [supabase, project.slug])

  useEffect(() => {
    if (!compareProjectId) return
    getProjectComparisonProfile(supabase, compareProjectId).then(setCompareProfile)
    listComparativeLinksBetweenProjects(supabase, project.id, compareProjectId).then(setComparativeLinks)
  }, [supabase, project.id, compareProjectId, refreshToken])

  const connectedTopicCount = useMemo(
    () => (topics ?? []).filter((tp) => (linksByObject[tp.id]?.length ?? 0) > 0).length,
    [topics, linksByObject]
  )

  return {
    project, role, supabase, templateId, config, canEdit,
    topics, linksByObject, regionRecords, connectedTopicCount,
    profile, compareProfile, compareName, compareProjectId, comparativeLinks, coverage,
    refresh,
  }
}
