import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, BookOpenText, CircleAlert, ClipboardList, FileCheck2, FileText, LoaderCircle, Printer, Sparkles } from 'lucide-react'
import { errorMessage } from '../components/ui'
import { api, type MilestoneProgress } from '../services/api'
import type { PipelineRun, ProjectIdea, ProjectReport } from '../types/models'

type ReportKind = 'synopsis' | 'progress' | 'final'
const reportOptions: { kind: ReportKind; title: string; description: string; icon: typeof FileText }[] = [
  { kind: 'synopsis', title: 'Project Synopsis', description: 'A concise overview of your idea, goals, and proposed solution.', icon: FileText },
  { kind: 'progress', title: 'Progress Report', description: 'Your milestone status, completed work, and next steps.', icon: ClipboardList },
  { kind: 'final', title: 'Final Project Report', description: 'A submission-ready summary of the project blueprint.', icon: FileCheck2 },
]

export default function Documentation() {
  const [projects, setProjects] = useState<ProjectIdea[]>([])
  const [projectId, setProjectId] = useState('')
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [milestones, setMilestones] = useState<MilestoneProgress[]>([])
  const [reports, setReports] = useState<ProjectReport[]>([])
  const [generated, setGenerated] = useState<ReportKind | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const project = projects.find(item => item.id === projectId) ?? null

  useEffect(() => {
    let cancelled = false
    api.listProjects().then(list => { if (!cancelled) { setProjects(list); setProjectId(list[0]?.id ?? '') } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setRun(null); setMilestones([]); setGenerated(null); setReports([])
    setError('')
    if (!project) return () => { cancelled = true }
    setDetailLoading(true)
    const runPromise = project.latestRunId ? api.getPipelineRun(project.latestRunId) : Promise.resolve(null)
    const reportsPromise = api.listReports(project.id).catch(() => [])
    Promise.all([runPromise, api.getMilestoneProgress(project.id).catch(() => []), reportsPromise])
      .then(([value, progress, reportList]) => { if (!cancelled) { setRun(value); setMilestones(progress); setReports(reportList) } })
      .catch(e => { if (!cancelled) setError(errorMessage(e)) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [projectId])

  const content = useMemo(() => generated && project ? makeReport(generated, project, run, milestones) : '', [generated, project, run, milestones])
  const generateReportFor = async (kind: ReportKind) => {
    if (!project) return
    // Check if report of this kind already exists
    const existing = reports.find(r => r.kind === kind)
    if (existing) {
      setGenerated(kind)
      return
    }
    setGenerating(true)
    setError('')
    try {
      const report = await api.generateReport(project.id, kind)
      setReports(prev => [...prev, report])
      setGenerated(kind)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setGenerating(false)
    }
  }
  const downloadFile = (blob: Blob, extension: string) => {
    if (!project || !generated) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${generated}-report.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const download = () => { if (content) downloadFile(new Blob([content], { type: 'text/markdown;charset=utf-8' }), 'md') }
  const downloadWord = () => { if (content && project) downloadFile(new Blob([makeWordHtml(content, project.title)], { type: 'application/msword;charset=utf-8' }), 'doc') }

  if (loading) return <p className="page-loading"><LoaderCircle className="spin" size={18} /> Loading your documents…</p>
  if (!project) return <section className="docs-empty">
    <span className="docs-empty-icon"><BookOpenText size={22} /></span><span className="muted-label">DOCUMENTATION</span>
    <h1>Your project reports will live here.</h1><p>Create a project first. After you submit an idea, generate a synopsis, progress report, or final report here.</p>
    {error && <p className="form-error" role="alert"><CircleAlert size={15} /> {error}</p>}
    <Link className="button button-primary" to="/create">Start a project</Link>
  </section>

  return <section className="documentation-page" aria-labelledby="documentation-title">
    <header className="docs-page-head">
      <div><span className="muted-label"><Sparkles size={13} /> PROJECT LIBRARY</span><h1 id="documentation-title">Documentation &amp; Reports</h1><p>Create clear project documents from your saved idea and blueprint.</p></div>
      <label className="docs-project-select"><span>SELECT PROJECT</span><select aria-label="Choose a project" value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    </header>
    {error && <p className="form-error" role="alert"><CircleAlert size={15} /> {error}</p>}
    <div className="docs-project-summary"><div className="docs-project-icon"><BookOpenText size={19} /></div><div><span className="muted-label">CURRENT PROJECT</span><strong>{project.title}</strong><p>{project.description}</p></div><Link to={`/projects/${project.id}`} className="docs-view-blueprint">View blueprint</Link></div>
    <div className="docs-report-grid">
      {reportOptions.map(option => {
        const Icon = option.icon
        const unavailable = option.kind !== 'synopsis' && !run?.results
        return <article className={`docs-report-card${generated === option.kind ? ' selected' : ''}`} key={option.kind}>
          <span className={`docs-report-icon ${option.kind}`}><Icon size={19} /></span>
          <div className="docs-report-copy"><h2>{option.title}</h2><p>{option.description}</p></div>
          <button type="button" className={generated === option.kind ? 'button button-primary' : 'button button-ghost'} onClick={() => generateReportFor(option.kind)} disabled={unavailable || detailLoading || generating}>
            {detailLoading ? <><LoaderCircle size={15} className="spin" /> Loading…</> : generating ? <><LoaderCircle size={15} className="spin" /> Generating…</> : generated === option.kind ? 'Generated' : 'Generate'}
          </button>
          {unavailable && <small>Available after the project analysis finishes.</small>}
        </article>
      })}
    </div>
    {generated && <section className="docs-preview" aria-labelledby="docs-preview-title">
      <div className="docs-preview-head"><div><span className="muted-label">REPORT PREVIEW</span><h2 id="docs-preview-title">{reportOptions.find(item => item.kind === generated)?.title}</h2></div><div className="docs-export-actions"><button type="button" className="button button-primary" onClick={() => window.print()}><Printer size={15} /> Save as PDF</button><button type="button" className="button button-ghost" onClick={downloadWord}><FileText size={15} /> Word (.doc)</button><button type="button" className="button button-ghost" onClick={download}><ArrowDownToLine size={15} /> Markdown</button></div></div>
      <pre>{content}</pre>
      <p className="docs-preview-note">Generated locally from your saved project information. Save as PDF opens your browser’s print dialog; choose “Save as PDF.” The Word file opens in Word-compatible applications. No paid AI request is made.</p>
    </section>}
  </section>
}

function makeReport(kind: ReportKind, project: ProjectIdea, run: PipelineRun | null, progress: MilestoneProgress[]) {
  const results = run?.results
  const updated = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const progressByWeek = new Map(progress.map(item => [item.week, item.status]))
  const lines = [`# ${project.title}`, '', `**Generated:** ${updated}`, `**Project area:** ${project.customDomain || project.domain.replace('_', ' ')}`, `**Duration:** ${project.durationWeeks} weeks`, '', '## Project idea', project.description, '']
  if (kind === 'synopsis') {
    lines.push('## Project overview', results?.scopeAndStack.summary ?? 'This synopsis is based on the project idea currently saved in your workspace.', '')
    if (results) lines.push('## Objectives', ...results.scopeAndStack.projectObjectives.map(item => `- ${item}`), '', '## Proposed solution', results.scopeAndStack.proposedSolution, '', '## Intended users', results.scopeAndStack.targetUsers, '', '## Initial technology choices', ...results.scopeAndStack.techStack.map(item => `- **${item.layer}:** ${item.choice} — ${item.reason}`))
  } else if (kind === 'progress' && results) {
    lines.push('## Current progress', `${progress.filter(item => item.status === 'done').length} of ${results.plan.milestones.length} milestones marked complete.`, '', '## Milestones', ...results.plan.milestones.flatMap(item => [`- **Week ${item.week} · ${item.title}:** ${({ planned: 'Not started', 'in-progress': 'In progress', 'half-done': 'Half done', done: 'Completed' }[progressByWeek.get(item.week) ?? item.status])}`, `  - ${item.tasks.join('; ')}`, `  - Deliverable: ${item.deliverables[0]}`]), '', '## Next step', results.plan.milestones.find(item => (progressByWeek.get(item.week) ?? item.status) !== 'done')?.title ?? 'Review final project deliverables.')
  } else if (kind === 'final' && results) {
    lines.push('## Abstract', results.scopeAndStack.summary, '', '## Objectives', ...results.scopeAndStack.projectObjectives.map(item => `- ${item}`), '', '## Project scope', '### Included in the MVP', ...(results.scopeAndStack.inScope.length ? results.scopeAndStack.inScope : results.scopeAndStack.mvp).map(item => `- ${item}`), '', '### Future expansion', ...results.scopeAndStack.outOfScope.map(item => `- ${item}`), '', '## Recommended technology', ...results.scopeAndStack.techStack.map(item => `- **${item.layer}: ${item.choice}.** ${item.reason}`), '', '## Execution plan', ...results.plan.milestones.map(item => `- **Week ${item.week}: ${item.title}.** ${item.tasks.join('; ')} Deliverable: ${item.deliverables[0]}`), '', '## Risks and mitigation', ...results.risk.risks.map(item => `- **${item.title} (${item.severity}):** ${item.mitigation}`), '', '## Feasibility', `${results.feasibility.verdict} · ${results.feasibility.score}/100.`, ...results.feasibility.recommendations.map(item => `- ${item}`))
  }
  return lines.join('\n')
}

function makeWordHtml(markdown: string, title: string) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const blocks = markdown.split('\n').map(line => {
    const safe = escape(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    if (line.startsWith('### ')) return `<h3>${escape(line.slice(4))}</h3>`
    if (line.startsWith('## ')) return `<h2>${escape(line.slice(3))}</h2>`
    if (line.startsWith('# ')) return `<h1>${escape(line.slice(2))}</h1>`
    if (line.startsWith('- ')) return `<p class="bullet">&#8226; ${safe.slice(2)}</p>`
    return line.trim() ? `<p>${safe}</p>` : '<p>&nbsp;</p>'
  }).join('\n')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><title>${escape(title)}</title><style>body{font-family:Calibri,Arial,sans-serif;color:#202333;line-height:1.55;margin:2.5cm}h1{color:#5544d8;font-size:24pt}h2{color:#5544d8;margin-top:22pt;font-size:16pt}h3{margin-top:16pt;font-size:13pt}.bullet{margin-left:18pt}</style></head><body>${blocks}</body></html>`
}
