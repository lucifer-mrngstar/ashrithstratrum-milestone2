import { DatabaseSync } from 'node:sqlite'
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scrypt = promisify(scryptCb)
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configuredDbPath = process.env.DB_PATH ?? 'server/data/projectmentor.sqlite'
export const databasePath = isAbsolute(configuredDbPath) ? configuredDbPath : resolve(projectRoot, configuredDbPath)
mkdirSync(dirname(databasePath), { recursive: true })
export const db = new DatabaseSync(databasePath)

db.exec(`PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status TEXT NOT NULL, data TEXT NOT NULL, cancel_requested INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS milestone_progress(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, week INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('planned','in-progress','half-done','done')), updated_at TEXT NOT NULL, PRIMARY KEY(project_id,week));
CREATE TABLE IF NOT EXISTS mentor_messages(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('student','mentor')), text TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('synopsis','progress','final')), content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_projects_student ON projects(student_id);
CREATE INDEX IF NOT EXISTS ix_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS ix_mentor_messages_project ON mentor_messages(project_id, created_at);
CREATE INDEX IF NOT EXISTS ix_reports_project ON reports(project_id, created_at);`)

const now = () => new Date().toISOString()
const id = (prefix) => `${prefix}_${randomBytes(16).toString('hex')}`
const tokenSecret = process.env.JWT_SECRET
if (!tokenSecret) throw new Error('Set JWT_SECRET in the backend .env before starting the server.')
const secret = tokenSecret
const b64 = (value) => Buffer.from(value).toString('base64url')

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64)
  return `${salt}:${Buffer.from(derived).toString('hex')}`
}
async function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':')
  const candidate = Buffer.from((await hashPassword(password, salt)).split(':')[1], 'hex')
  const expected = Buffer.from(digest, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export async function register({ name, email, password }) {
  const normalized = email.trim().toLowerCase()
  const user = { id: id('usr'), name: name.trim(), email: normalized, createdAt: now() }
  try { db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, user.name, user.email, await hashPassword(password), user.createdAt) }
  catch (error) { if (String(error).includes('UNIQUE')) throw Object.assign(new Error('An account with this email already exists.'), { status: 409 }); throw error }
  return createSession(user)
}

export async function login({ email, password }) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
  if (!row || !(await verifyPassword(password, row.password_hash))) throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 })
  return createSession({ id: row.id, name: row.name, email: row.email, createdAt: row.created_at })
}

function createSession(user) {
  const sessionId = id('ses')
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(sessionId, user.id, exp)
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(JSON.stringify({ sub: user.id, sid: sessionId, exp }))
  const unsigned = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return { user, token: `${unsigned}.${signature}` }
}

export function authenticate(request) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw Object.assign(new Error('Please sign in to continue.'), { status: 401 })
  try {
    const [header, payload, signature] = token.split('.')
    const unsigned = `${header}.${payload}`
    const expected = createHmac('sha256', secret).update(unsigned).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('signature')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const session = db.prepare('SELECT * FROM sessions WHERE id=? AND user_id=?').get(claims.sid, claims.sub)
    const user = db.prepare('SELECT id,name,email,created_at AS createdAt FROM users WHERE id=?').get(claims.sub)
    if (!session || !user || session.expires_at < Date.now() / 1000 || claims.exp < Date.now() / 1000) throw new Error('expired')
    return user
  } catch { throw Object.assign(new Error('Your session is invalid or expired. Please sign in again.'), { status: 401 }) }
}

export function logout(request) {
  const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (token) { try { const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); db.prepare('DELETE FROM sessions WHERE id=?').run(claims.sid) } catch {} }
}

export function saveProfile(user, data) {
  const prior = db.prepare('SELECT id,data FROM profiles WHERE user_id=?').get(user.id)
  const profile = { ...data, id: prior?.id ?? id('stu'), userId: user.id, createdAt: prior ? JSON.parse(prior.data).createdAt : now(), updatedAt: now() }
  db.prepare('INSERT INTO profiles(id,user_id,data) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(profile.id, user.id, JSON.stringify(profile))
  return profile
}
export function getProfile(user) { const row = db.prepare('SELECT data FROM profiles WHERE user_id=?').get(user.id); return row ? JSON.parse(row.data) : null }
export function ownsProfile(user, studentId) { return db.prepare('SELECT id FROM profiles WHERE id=? AND user_id=?').get(studentId, user.id) }
export function createProject(data) { const project = { ...data, id: id('prj'), createdAt: now() }; db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run(project.id, project.studentId, JSON.stringify(project), project.createdAt); return project }
export function getProject(user, projectId) { const row = db.prepare('SELECT p.data FROM projects p JOIN profiles s ON s.id=p.student_id WHERE p.id=? AND s.user_id=?').get(projectId,user.id); return row ? JSON.parse(row.data) : null }
export function getMilestoneProgress(user, projectId) {
  return db.prepare('SELECT mp.week,mp.status,mp.updated_at AS updatedAt FROM milestone_progress mp JOIN projects p ON p.id=mp.project_id JOIN profiles s ON s.id=p.student_id WHERE mp.project_id=? AND s.user_id=? ORDER BY mp.week').all(projectId,user.id)
}
export function setMilestoneProgress(user, projectId, week, status) {
  db.prepare(`INSERT INTO milestone_progress(project_id,week,status,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(project_id,week) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`).run(projectId,week,status,now())
  return { week, status, updatedAt: now() }
}
export function setLatestRun(projectId, runId) { const row=db.prepare('SELECT data FROM projects WHERE id=?').get(projectId); if(row){const project=JSON.parse(row.data);project.latestRunId=runId;db.prepare('UPDATE projects SET data=? WHERE id=?').run(JSON.stringify(project),projectId)} }
export function listProjects(user, studentId) { return db.prepare('SELECT p.data FROM projects p JOIN profiles s ON s.id=p.student_id WHERE s.user_id=? AND s.id=? ORDER BY p.created_at DESC').all(user.id,studentId).map(row=>JSON.parse(row.data)) }
export function saveRun(run) { db.prepare('INSERT INTO runs(id,project_id,status,data,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data').run(run.id,run.projectId,run.status,JSON.stringify(run),run.createdAt); }
export function getRun(user, runId) { const row=db.prepare('SELECT r.data FROM runs r JOIN projects p ON p.id=r.project_id JOIN profiles s ON s.id=p.student_id WHERE r.id=? AND s.user_id=?').get(runId,user.id); return row?JSON.parse(row.data):null }
export function requestCancel(user, runId) { return db.prepare('UPDATE runs SET cancel_requested=1 WHERE id=? AND project_id IN (SELECT p.id FROM projects p JOIN profiles s ON s.id=p.student_id WHERE s.user_id=?) AND status IN (\'queued\',\'running\')').run(runId,user.id).changes>0 }
export function isCancelled(runId) { return Boolean(db.prepare('SELECT cancel_requested FROM runs WHERE id=?').get(runId)?.cancel_requested) }
export function deleteProject(user, projectId) { return db.prepare('DELETE FROM projects WHERE id=? AND student_id IN (SELECT id FROM profiles WHERE user_id=?)').run(projectId,user.id).changes>0 }

export function saveMentorMessage(user, projectId, role, text) {
  const project = getProject(user, projectId)
  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 })
  const message = { id: id('msg'), projectId, role, text, createdAt: now() }
  db.prepare('INSERT INTO mentor_messages(id, project_id, role, text, created_at) VALUES(?, ?, ?, ?, ?)')
    .run(message.id, message.projectId, message.role, message.text, message.createdAt)
  return message
}

export function getMentorMessages(user, projectId) {
  const project = getProject(user, projectId)
  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 })
  return db.prepare('SELECT id, project_id AS projectId, role, text, created_at AS createdAt FROM mentor_messages WHERE project_id = ? ORDER BY created_at ASC')
    .all(projectId)
}

export function saveReport(user, projectId, kind, content) {
  const project = getProject(user, projectId)
  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 })
  const report = { id: id('rep'), projectId, kind, content, createdAt: now() }
  db.prepare('INSERT INTO reports(id, project_id, kind, content, created_at) VALUES(?, ?, ?, ?, ?)')
    .run(report.id, report.projectId, report.kind, report.content, report.createdAt)
  return report
}

export function listReports(user, projectId) {
  const project = getProject(user, projectId)
  if (!project) throw Object.assign(new Error('Project not found.'), { status: 404 })
  return db.prepare('SELECT id, project_id AS projectId, kind, content, created_at AS createdAt FROM reports WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId)
}

export function getReport(user, reportId) {
  const row = db.prepare(`SELECT r.id, r.project_id AS projectId, r.kind, r.content, r.created_at AS createdAt
    FROM reports r
    JOIN projects p ON p.id = r.project_id
    JOIN profiles s ON s.id = p.student_id
    WHERE r.id = ? AND s.user_id = ?`).get(reportId, user.id)
  return row ?? null
}

export function close() {
  db.close()
}