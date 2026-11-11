import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BrainCircuit, Calculator, Check, ChevronDown, ChevronRight, Clock3, FolderKanban, Gauge, Lightbulb, Orbit, Package, Rocket, ShieldCheck, Sparkles, Sprout, Target, TrendingUp, UsersRound, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../services/api'
import { LEVEL_LABELS, PROFICIENCY_LABELS, projectTypeLabel, readinessBreakdown } from '../lib/skills'
import { pipelineStages } from '../agents/registry'
 
import type { Proficiency, ProjectIdea, RunStatus, StudentProfile } from '../types/models'

const RUN_LABELS: Record<RunStatus, string> = { queued: 'Queued', running: 'In progress', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }

const IDEA_TIPS: { key: string; icon: LucideIcon; title: string; text: string }[] = [
  { key: 'problem', icon: Target, title: 'Solve a real problem', text: 'Pick something you or your classmates actually face — it makes testing with real users easy.' },
  { key: 'users', icon: UsersRound, title: 'Name your users', text: 'Say who it is for: students, faculty, a local shop… Specific users lead to specific features.' },
  { key: 'core', icon: Sprout, title: 'Start small', text: 'Describe the one core feature first. Extras can come after the first version works.' },
  { key: 'needs', icon: Package, title: 'Check what you need', text: 'Datasets, hardware or APIs can take time to get — mention them in your idea.' },
]

const EXAMPLE_IDEA: { text: string; tip?: string }[] = [
  { text: 'Students at our college', tip: 'users' },
  { text: ' ' },
  { text: 'waste time walking around to find an empty classroom to study in.', tip: 'problem' },
  { text: ' This web app ' },
  { text: 'shows which rooms are free right now', tip: 'core' },
  { text: ', ' },
  { text: "using the timetable data from the admin office.", tip: 'needs' },
]

const WORKFLOW = [
  { icon: Lightbulb, title: 'Your idea', text: 'Start with a problem worth solving.' },
  { icon: BrainCircuit, title: 'Feasibility', text: 'Consider your skills and available time.' },
  { icon: Orbit, title: 'Scope & technology', text: 'Define a manageable scope and stack.' },
  { icon: Clock3, title: 'Milestones', text: 'Break the work into achievable steps.' },
  { icon: ShieldCheck, title: 'Risks', text: 'Surface likely blockers and mitigations.' },
  { icon: Check, title: 'Project blueprint', text: 'Bring the planning into one view.' },
]
const PIPELINE_STAGES = pipelineStages()

/** Signed out: a short welcome. Signed in: the student's dashboard. */
export default function Home({ profile }: { profile: StudentProfile | null }) {
  const { user } = useAuth()
  return user ? <Dashboard name={user.name} profile={profile} /> : <Welcome />
}

function Welcome() {
  const [selectedStep, setSelectedStep] = useState(0)
  return (
    <div className="landing">
      <section className="landing-hero">
        <div className="landing-wrap landing-hero-inner">
          <div className="landing-copy">
            <span className="landing-eyebrow"><Sparkles size={15} /> A clearer path from idea to impact</span>
            <h1>Plan. Build. Succeed.<br /><em>With your AI project mentor.</em></h1>
            <p className="landing-lead">Turn your project idea into a structured plan, get continuous guidance, track progress, and prepare your documentation—all in one place.</p>
            <div className="landing-cta">
              <Link className="button button-primary" to="/register">Get started <ArrowRight size={16} /></Link>
              <Link className="button button-ghost" to="/sign-in">Sign in</Link>
              <span className="landing-cta-note">A guided workspace for student projects</span>
            </div>
          </div>

          <section className="landing-preview" aria-label="Preview of the project planning workflow">
            <div className="landing-preview-head">
              <div><span className="muted-label">PROJECT WORKSPACE</span><strong>From first thought to a plan</strong></div>
              <span className="landing-preview-badge">Step {selectedStep + 1} of {WORKFLOW.length}</span>
            </div>
            <ol className="landing-workflow">
              {WORKFLOW.map((step, index) => (
                <li key={step.title}>
                  <button type="button" className={`landing-workflow-step ${index === selectedStep ? 'on' : ''}`} aria-pressed={index === selectedStep} onClick={() => setSelectedStep(index)}>
                  <span className="landing-wf-icon"><step.icon size={17} /></span>
                  <span className="landing-wf-body"><strong>{step.title}</strong><span>{step.text}</span></span>
                  <span className="landing-wf-status">{index === selectedStep ? 'Exploring' : 'Explore'}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="landing-preview-note">A preview of the designed workflow—not a claim that analysis has already run.</p>
          </section>
        </div>
      </section>

      <section className="landing-section landing-wrap" aria-labelledby="landing-how-title">
        <div className="landing-section-head">
          <span className="muted-label">A PRACTICAL STARTING POINT</span>
          <h2 id="landing-how-title">Good project work starts with a plan that fits you.</h2>
          <p>Build a student profile, check your skills, and share a rough idea. The workspace keeps your submission and its pipeline status together.</p>
        </div>
        <div className="landing-features">
          <article className="landing-feature">
            <span className="landing-feature-icon"><Gauge size={20} /></span>
            <h3>Start with your strengths</h3>
            <p>Record your skills, experience, and available weekly hours so planning has useful context.</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature-icon"><Lightbulb size={20} /></span>
            <h3>Shape an idea without overthinking it</h3>
            <p>Use practical prompts to describe the problem, who it affects, and a sensible first version.</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature-icon"><Orbit size={20} /></span>
            <h3>Follow the analysis workflow</h3>
            <p>Track your analysis status and see whether the report came from the demo engine or a live LLM backend.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-wrap" aria-labelledby="landing-pipeline-title">
        <div className="landing-section-head">
          <span className="muted-label">PROJECT ANALYSIS WORKFLOW</span>
          <h2 id="landing-pipeline-title">A structured review, one concern at a time.</h2>
          <p>Each submission produces a validated report covering feasibility, scope and technology, timeline, and risks. Choose the deterministic demo engine or configure a live LLM backend.</p>
        </div>
        <div className="landing-pipeline-diagram" role="group" aria-label="Designed workflow stages">
          <div className="landing-pipe-node highlight"><Lightbulb size={18} /><strong>Your idea</strong><span>Student submission</span></div>
          {PIPELINE_STAGES.map((stage, index) => (
            <Fragment key={stage[0].id}>
              <ArrowRight className="landing-pipe-arrow" size={18} aria-hidden="true" />
              <div className={`landing-pipe-stage ${stage.length > 1 ? 'parallel' : ''}`}>
                <span className="landing-pipe-stage-label">Stage {index + 1}{stage.length > 1 ? ' · parallel' : ''}</span>
                {stage.map(agent => (
                  <div className="landing-pipe-node" key={agent.id}>
                    <agent.icon size={18} /><strong>{agent.name}</strong><span>Report section</span>
                  </div>
                ))}
              </div>
            </Fragment>
          ))}
          <ArrowRight className="landing-pipe-arrow" size={18} aria-hidden="true" />
          <div className="landing-pipe-node highlight"><Check size={18} /><strong>Project blueprint</strong><span>Planned outcome</span></div>
        </div>
        <p className="landing-pipeline-note">The current implementation generates all four report sections in a single analysis operation; it does not make a separate LLM call per section.</p>
      </section>

      <section className="landing-section landing-wrap">
        <div className="landing-cta-band">
          <h2>Start with the idea you have.</h2>
          <p>It does not need to be perfect. A few sentences are enough to begin planning.</p>
          <div className="landing-cta">
            <Link className="button button-primary" to="/register">Create your workspace <ArrowUpRight size={16} /></Link>
            <Link className="button button-ghost" to="/sign-in">I already have an account</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

type ProjectWithStatus = ProjectIdea & { runStatus?: RunStatus; runProgress?: number }

function Dashboard({ name, profile }: { name: string; profile: StudentProfile | null }) {
  const [projects, setProjects] = useState<ProjectWithStatus[] | null>(null)
  useEffect(() => {
    let cancelled = false
    api.listProjects()
      .then(list => Promise.all(list.map(async p => {
        const run = p.latestRunId ? await api.getPipelineRun(p.latestRunId).catch(() => null) : null
        const finished = run?.steps.filter(step => step.status === 'completed').length ?? 0
        return { ...p, runStatus: run?.status, runProgress: run?.status === 'completed' ? 100 : Math.round(finished / (run?.steps.length || 1) * 100) }
      })))
      .then(list => { if (!cancelled) setProjects(list) })
      .catch(() => { if (!cancelled) setProjects([]) })
    return () => { cancelled = true }
  }, [])

  const recent = projects?.slice(0, 5) ?? []
  const activeCount = projects?.filter(p => p.runStatus !== 'completed' && p.runStatus !== 'cancelled').length ?? 0
  const completedCount = projects?.filter(p => p.runStatus === 'completed').length ?? 0
  const pendingCount = projects?.filter(p => p.runStatus === 'queued' || p.runStatus === 'running').length ?? 0
  const overallProgress = projects?.length ? Math.round(projects.reduce((sum, p) => sum + (p.runProgress ?? 0), 0) / projects.length) : 0
  const details = profile && [`${profile.course} · ${profile.year}`, `${profile.weeklyHours} h/week`].join('  ·  ')

  return (
    <>
      <header className="page-header">
        <div><span className="muted-label">STUDENT WORKSPACE</span><h1>Welcome back, {name.split(' ')[0]} 👋</h1><p>{details ?? 'Finish setting up so the agents can tailor their analysis to you.'}</p></div>
      </header>

      {!profile && (
        <div className="callout">
          <div><strong>Complete your profile</strong><span>About 5 minutes: your details, skills and a short skill quiz.</span></div>
          <Link className="button button-primary" to="/onboarding">Continue setup <ArrowRight size={16} /></Link>
        </div>
      )}

      {profile && (
        <ul className="stat-tiles dashboard-summary" aria-label="Project overview">
          <li><span className="stat-icon"><FolderKanban size={18} /></span><div><strong>{projects === null ? '–' : activeCount}</strong><span>Active projects</span></div></li>
          <li><span className="stat-icon summary-green"><Check size={18} /></span><div><strong>{completedCount}</strong><span>Completed</span></div></li>
          <li><span className="stat-icon summary-warm"><Clock3 size={18} /></span><div><strong>{pendingCount}</strong><span>Pending tasks</span></div></li>
          <li><span className="stat-icon summary-blue"><TrendingUp size={18} /></span><div><strong>{overallProgress}%</strong><span>Overall progress</span></div></li>
        </ul>
      )}

      <div className="dash-grid">
        <div className="dash-col">
          <section className="panel" aria-labelledby="dash-projects">
            <div className="panel-head"><h2 id="dash-projects">Recent projects</h2>{projects && projects.length > 5 && <Link className="link-button" to="/projects">View all</Link>}</div>
            {projects === null ? <p className="panel-empty">Loading…</p>
              : recent.length === 0 ? <p className="panel-empty">No projects yet. Use the New idea button in the top bar to get started.</p>
                : <ul className="row-list">{recent.map(p => (
                  <li key={p.id}><Link to={`/projects/${p.id}`}>
                    <div className="dashboard-project-copy"><strong>{p.title}</strong><span>{projectTypeLabel(p)} · Updated {new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>{p.runStatus && <span className="dashboard-project-progress"><i><i style={{ width: `${p.runProgress ?? 0}%` }} /></i><b>{p.runProgress ?? 0}%</b></span>}</div>
                    <span className="row-end">{p.runStatus && <span className={`run-status ${p.runStatus}`}>{RUN_LABELS[p.runStatus]}</span>}<ChevronRight size={18} /></span>
                  </Link></li>
                ))}</ul>}
          </section>

          <section className="panel" aria-labelledby="dash-tips">
            <div className="panel-head">
              <div><h2 id="dash-tips"><Lightbulb size={17} /> Tips for a strong project idea</h2><p className="panel-sub">Two or three sentences that cover these four things are enough.</p></div>
            </div>
            <ul className="tips">{IDEA_TIPS.map((t, i) => (
              <li key={t.key} className={`tip-${t.key}`}>
                <span className="tip-icon"><t.icon size={18} /></span>
                <div><strong><span className="tip-num">{i + 1}</span> {t.title}</strong><span>{t.text}</span></div>
              </li>
            ))}</ul>
            <details className="idea-example">
              <summary><ChevronDown size={16} className="chevron" /> See an example of a strong idea</summary>
              <blockquote>{EXAMPLE_IDEA.map((part, i) => part.tip ? <mark key={i} className={`tip-${part.tip}`}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</blockquote>
              <ul className="example-legend">{IDEA_TIPS.map((t, i) => <li key={t.key} className={`tip-${t.key}`}><i /> {i + 1}. {t.title}</li>)}</ul>
            </details>
          </section>
        </div>

        {profile && (
          <div className="dash-col">
            <section className="panel" aria-labelledby="dash-skills">
              <div className="panel-head"><h2 id="dash-skills">Your skills</h2></div>
              <SkillMix levels={profile.skills.map(s => s.level)} />
              <ul className="skill-rows">{profile.skills.map(s => (
                <li key={s.skill}>
                  <span>{s.skill}{s.quiz && <Check size={13} aria-label="verified by quiz" className="verified" />}</span>
                  <span className={`level-pill l${s.level}`}>{PROFICIENCY_LABELS[s.level]}</span>
                </li>
              ))}</ul>
            </section>

            <ReadinessPanel profile={profile} />
          </div>
        )}
      </div>
    </>
  )
}

/** Stacked bar of how many skills sit at each level. */
function SkillMix({ levels }: { levels: Proficiency[] }) {
  const counts = ([3, 2, 1] as Proficiency[]).map(l => ({ level: l, count: levels.filter(x => x === l).length }))
  return (
    <div className="skill-mix">
      <div className="skill-mix-bar" role="img" aria-label={counts.map(c => `${c.count} ${PROFICIENCY_LABELS[c.level].toLowerCase()}`).join(', ')}>
        {counts.filter(c => c.count).map(c => <span key={c.level} className={`l${c.level}`} style={{ flexGrow: c.count }} />)}
      </div>
      <ul className="skill-mix-legend">{counts.map(c => <li key={c.level}><i className={`l${c.level}`} /> {c.count} {PROFICIENCY_LABELS[c.level]}</li>)}</ul>
    </div>
  )
}

/** One plain-language action per part of the readiness score. */
function readinessActions(profile: StudentProfile) {
  const parts = Object.fromEntries(readinessBreakdown(profile.skills, profile.priorProjects, profile.weeklyHours).map(p => [p.key, p]))
  const skillCount = profile.skills.length
  return [
    {
      key: 'skills', icon: BrainCircuit, part: parts.skills,
      title: 'Learn more skills',
      status: `You have ${skillCount} skill${skillCount === 1 ? '' : 's'} so far`,
      gain: parts.skills.max - parts.skills.points,
    },
    {
      key: 'experience', icon: Rocket, part: parts.experience,
      title: profile.priorProjects === 'one' ? 'Build another project' : 'Build a project outside class',
      status: { none: "You haven't built one yet", one: "You've built one", several: "You've built several" }[profile.priorProjects],
      // The next step only: one project is worth 12 points, several 25.
      gain: profile.priorProjects === 'none' ? 12 : parts.experience.max - parts.experience.points,
    },
    {
      key: 'time', icon: Clock3, part: parts.time,
      title: 'Give more time each week',
      status: profile.weeklyHours >= 15 ? `You give ${profile.weeklyHours} hours a week` : `You give ${profile.weeklyHours} hour${profile.weeklyHours === 1 ? '' : 's'} — aim for 15`,
      gain: parts.time.max - parts.time.points,
    },
  ]
}

/** Short names of skills worth learning next, worked out from the current profile (not stored text). */
function nextSkills(profile: StudentProfile) {
  const has = (category: string) => profile.skills.some(s => s.category === category)
  const list = profile.skills.filter(s => s.quiz && s.quiz.level < s.selfLevel).map(s => `Strengthen ${s.skill}`)
  if (!profile.skills.some(s => s.skill === 'Git')) list.push('Git')
  if (!has('data')) list.push('SQL or pandas')
  if (!has('web') && !has('design')) list.push('Simple UI (HTML / CSS)')
  return list.slice(0, 4)
}

/** The readiness score as a short to-do list: what to do, where you are now, and the points it adds. */
function ReadinessPanel({ profile }: { profile: StudentProfile }) {
  const actions = readinessActions(profile)
  const skills = nextSkills(profile)
  const { score, level } = profile.assessment
  const dialogRef = useRef<HTMLDialogElement>(null)

  return (
    <section className="panel" aria-labelledby="dash-readiness">
      <div className="panel-head"><h2 id="dash-readiness"><TrendingUp size={17} /> How to raise your readiness</h2><Link className="link-button" to={{ pathname: '/onboarding', search: '?edit=skills' }} state={{ from: '/' }}>Update</Link></div>
      <p className="panel-sub readiness-intro">You're at <strong>{score}/100</strong> — {LEVEL_LABELS[level]}. Do these to improve:</p>

      <ul className="actions">{actions.map(a => (
        <li key={a.key} className={a.gain ? undefined : 'done'}>
          <span className="action-icon"><a.icon size={18} /></span>
          <div className="action-body">
            <div className="action-head">
              <strong>{a.title}</strong>
              {a.gain ? <span className="gain-chip">+{a.gain} pts</span> : <span className="gain-chip done"><Check size={12} /> Done</span>}
            </div>
            <span className="action-status">{a.status}</span>
            <div className="breakdown-track" role="progressbar" aria-label={a.title} aria-valuemin={0} aria-valuemax={a.part.max} aria-valuenow={a.part.points}><span style={{ width: `${(a.part.points / a.part.max) * 100}%` }} /></div>
          </div>
        </li>
      ))}</ul>

      {skills.length > 0 && <>
        <span className="muted-label">SKILLS TO LEARN NEXT</span>
        <ul className="skill-chips">{skills.map(sk => <li key={sk}><Sprout size={13} /> {sk}</li>)}</ul>
      </>}

      <div className="score-rules">
        <button type="button" className="link-button" onClick={() => dialogRef.current?.showModal()}><Calculator size={15} /> How is my score calculated?</button>
      </div>

      {/* A modal keeps the dashboard's height unchanged instead of stretching this card. */}
      <dialog className="score-dialog" ref={dialogRef} aria-labelledby="score-dialog-title" onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close() }}>
        <div className="score-dialog-head">
          <h2 id="score-dialog-title"><Calculator size={18} /> How your readiness score is calculated</h2>
          <button type="button" className="dialog-close" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={18} /></button>
        </div>
        <div className="score-dialog-body">
          <ul className="score-rule-list">
            <li><strong>Skills — up to 60 points</strong><span>Each skill counts by level: Beginner 1, Intermediate 2, Advanced 3. Add them up and multiply by 5 (12 or more points = full 60).</span></li>
            <li><strong>Project experience — up to 25 points</strong><span>One project outside class = 12, several = 25.</span></li>
            <li><strong>Weekly time — up to 15 points</strong><span>1 point for each hour per week, up to 15 hours.</span></li>
          </ul>
          <ScoreMath profile={profile} />
        </div>
      </dialog>
    </section>
  )
}

/** The student's own numbers for every part of the score, ending with the total. */
function ScoreMath({ profile }: { profile: StudentProfile }) {
  const skillPoints = profile.skills.reduce((sum, s) => sum + s.level, 0)
  const skills = Math.min(skillPoints, 12) * 5
  const experienceOptions = [
    { key: 'none', label: 'Not yet', points: 0 },
    { key: 'one', label: 'One project', points: 12 },
    { key: 'several', label: 'Several projects', points: 25 },
  ] as const
  const experience = experienceOptions.find(o => o.key === profile.priorProjects)!.points
  const time = Math.min(15, Math.max(0, Math.round(profile.weeklyHours)))

  return (
    <div className="skill-math">
      <span className="muted-label">YOUR CALCULATION</span>

      <h4>1. Skills</h4>
      <ul>{profile.skills.map(s => (
        <li key={s.skill}><span>{s.skill} <small>({PROFICIENCY_LABELS[s.level]}{s.quiz ? ', from quiz' : ''})</small></span><b>{s.level}</b></li>
      ))}</ul>
      <p>{skillPoints} point{skillPoints === 1 ? '' : 's'}{skillPoints > 12 ? ' (counted as 12)' : ''} × 5 = <b>{skills} / 60</b></p>

      <h4>2. Project experience</h4>
      <ul>{experienceOptions.map(o => (
        <li key={o.key} className={o.key === profile.priorProjects ? 'chosen' : undefined}><span>{o.label}{o.key === profile.priorProjects && <small> (your answer)</small>}</span><b>{o.points}</b></li>
      ))}</ul>
      <p>Your answer = <b>{experience} / 25</b></p>

      <h4>3. Weekly time</h4>
      <p className="no-rule">{profile.weeklyHours} hour{profile.weeklyHours === 1 ? '' : 's'} a week × 1 point{profile.weeklyHours > 15 ? ' (counted as 15)' : ''} = <b>{time} / 15</b></p>

      <p className="score-total">Total: {skills} + {experience} + {time} = <b>{skills + experience + time} / 100</b></p>
    </div>
  )
}
