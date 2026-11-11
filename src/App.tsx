import { useEffect, useState, Suspense, lazy } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowUpRight, BookOpenText, FolderKanban, LayoutDashboard, MessageCircle, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react'
import { RequireAuth, useAuth } from './auth/AuthContext'
import { Brand, PageLoading } from './components/ui'
import { UserMenu } from './components/UserMenu'
import { ThemeMenu, ThemeToggle } from './components/ThemeMenu'
import IntroAnimation from './components/IntroAnimation'
import { SiteFooter } from './components/SiteFooter'
import { api } from './services/api'
import type { StudentProfile } from './types/models'
import Home from './pages/Home'
import Onboarding from './pages/Onboarding'
const CreateProject = lazy(() => import('./pages/CreateProject'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectRun = lazy(() => import('./pages/ProjectRun'))
const Mentor = lazy(() => import('./pages/Mentor'))
const Documentation = lazy(() => import('./pages/Documentation'))
import { ForgotPassword, Register, SignIn } from './pages/Auth'

const pageTitle = (pathname: string) =>
  pathname === '/sign-in' ? 'Sign in · Stratum'
    : pathname === '/forgot-password' ? 'Forgot password · Stratum'
    : pathname === '/register' ? 'Create account · Stratum'
    : pathname === '/onboarding' ? 'Your profile · Stratum'
    : pathname === '/create' ? 'Share your idea · Stratum'
      : pathname === '/projects' ? 'My projects · Stratum'
        : pathname === '/mentor' ? 'AI Mentor · Stratum'
          : pathname === '/documentation' ? 'Documentation & Reports · Stratum'
        : pathname.startsWith('/projects/') ? 'Project · Stratum'
          : 'Stratum — Academic Project Mentor'

/** Scrolls to the top on page change, or to the #section in the URL once it has rendered. */
function useScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    document.title = pageTitle(pathname)
    if (!hash) { window.scrollTo({ top: 0 }); return }
    let frame = 0, tries = 0
    const find = () => {
      const target = document.getElementById(hash.slice(1))
      if (target) target.scrollIntoView({ behavior: 'smooth' })
      else if (tries++ < 60) frame = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])
}

// The intro plays once per browser tab session, not on every page change or refresh.
const INTRO_KEY = 'projectmentor:intro-seen'
const introSeen = () => { try { return sessionStorage.getItem(INTRO_KEY) === '1' } catch { return false } }
const markIntroSeen = () => { try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* storage blocked: it may play again */ } }

function App() {
  const location = useLocation()
  const { user } = useAuth()
  const [profile, setProfile] = useState<StudentProfile | null>(() => api.getProfile())
  const isLanding = location.pathname === '/' && !user
  const isStudentShell = Boolean(user && !['/sign-in', '/register', '/forgot-password'].includes(location.pathname))
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Each account has its own profile: reload it whenever someone signs in or out.
  useEffect(() => {
    let cancelled=false
    setProfile(api.getProfile())
    if(user) api.loadProfile().then(value=>{if(!cancelled)setProfile(value)}).catch(()=>{})
    return ()=>{cancelled=true}
  }, [user?.id])
  useScrollManager()
  const [showIntro, setShowIntro] = useState(() => !introSeen())
  const endIntro = () => { markIntroSeen(); setShowIntro(false) }


  return (
    <div className={`app-shell${isStudentShell ? ` student-app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}` : ''}`} id="top">
      {showIntro && <IntroAnimation onComplete={endIntro} />}
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="navbar">
        <div className="nav-inner">
          <Brand />
          <nav aria-label="Main" className="nav-bar">
            {!user && <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/" end>Home</NavLink>}
            {user ? <>
              <Link className="button button-small button-light nav-create" to="/create">New idea <ArrowUpRight size={14} /></Link>
              <ThemeToggle />
              <UserMenu />
            </> : <>
              <NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/sign-in">Sign in</NavLink>
              <Link className="button button-small button-light" to="/register">Get started <ArrowUpRight size={15} /></Link>
              <ThemeMenu />
            </>}
          </nav>
        </div>
      </header>

      {isStudentShell && <StudentSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} />}

      <AnimatePresence mode="wait">
        <motion.main id="main" tabIndex={-1} key={location.pathname} className={isLanding ? 'page landing-page' : 'page section-wrap'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .15 }}>
          <Suspense fallback={<PageLoading message="Loading page…" />}>
            <Routes location={location}>
              <Route path="/" element={<Home profile={profile} />} />
              <Route path="/register" element={<Register />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/onboarding" element={<RequireAuth><Onboarding profile={profile} onSaved={setProfile} /></RequireAuth>} />
              <Route path="/create" element={<RequireAuth><CreateProject profile={profile} /></RequireAuth>} />
              <Route path="/projects" element={<RequireAuth><Projects /></RequireAuth>} />
              <Route path="/mentor" element={<RequireAuth><Mentor /></RequireAuth>} />
              <Route path="/documentation" element={<RequireAuth><Documentation /></RequireAuth>} />
              <Route path="/projects/:projectId" element={<RequireAuth><ProjectRun /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
    </div>
  )
}

function StudentSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const primary = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'My projects', icon: FolderKanban },
    { to: '/mentor', label: 'AI mentor', icon: MessageCircle },
    { to: '/documentation', label: 'Documentation', icon: BookOpenText },
    { to: '/onboarding', label: 'Profile', icon: UserRound },
  ]
  return <aside className="student-sidebar" data-collapsed={collapsed} aria-label="Student workspace">
    <button className="sidebar-label" type="button" aria-expanded={!collapsed} onClick={onToggle} title={collapsed ? 'Expand workspace menu' : 'Collapse workspace menu'}>
      <span className="sidebar-label-full">WORKSPACE</span><span className="sidebar-label-short">WORK</span>
      {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
    </button>
    <nav aria-label="Student workspace navigation" className="sidebar-links">
      {primary.map(item => <NavLink key={item.to} to={item.to} end={item.end} title={collapsed ? item.label : undefined} className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}><item.icon size={17} /><span>{item.label}</span></NavLink>)}
    </nav>
    <p className="sidebar-note">Your project workspace, from first idea to final report.</p>
  </aside>
}

export default App
