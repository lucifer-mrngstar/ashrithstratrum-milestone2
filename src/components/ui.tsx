import type { CSSProperties } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Brand() {
  return <Link to="/" className="brand" aria-label="Stratum Academic Project Mentor home">
    <img src="/stratum-mark-clean.png" alt="" className="brand-mark"/>
    <span className="brand-text"><span className="brand-word"><strong>Stratum</strong><svg viewBox="0 0 100 25" aria-hidden="true"><path d="M2 23 C34 2 66 1 86 7" fill="none" stroke="url(#brandArc)" strokeWidth="1.6"/><path d="M91 1 93.3 7.2 100 9.5 93.3 11.8 91 18 88.7 11.8 82 9.5 88.7 7.2Z" fill="#8B72FF"/><defs><linearGradient id="brandArc"><stop stopColor="#42CFFF"/><stop offset="1" stopColor="#7255FF"/></linearGradient></defs></svg></span><small>ACADEMIC PROJECT MENTOR</small></span>
  </Link>
}

const FLOW = ['Your profile', 'Skill check', 'Your idea']

/** Progress through the setup flow: 0 = profile, 1 = skills, 2 = idea. */
export function FlowSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flow-steps" aria-label="Setup progress">
      {FLOW.map((label, i) => (
        <li key={label} className={i < current ? 'done' : i === current ? 'active' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="flow-dot">{i < current ? <Check size={12} aria-label="Done" /> : `0${i + 1}`}</span>
          <span className="flow-label">{label}</span>
        </li>
      ))}
    </ol>
  )
}

export function ScoreRing({ score, size = 'md', label }: { score: number; size?: 'md' | 'lg'; label: string }) {
  return (
    <div className={`ring ring-${size}`} style={{ '--p': `${score}%` } as CSSProperties} role="img" aria-label={`${label}: ${score} out of 100`}>
      <span>{score}</span>
    </div>
  )
}

export const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.'

export function PageLoading({ message = 'Loading…' }: { message?: string }) {
  return <p className="page-loading"><LoaderCircle className="spin" size={18} /> {message}</p>
}
