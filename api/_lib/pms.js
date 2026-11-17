// Shared by the /api functions that talk to the Widebed PMS (files starting with "_" are not deployed as functions).
//
// How a PMS caller is checked (see docs/PMS_LINK.md):
//   1. The request carries the person's PMS Firebase ID token (Authorization: Bearer ...).
//   2. firebase-admin checks it against the PMS project using only its project ID. No PMS key is needed.
//   3. Their PMS staff record users/{uid} is read from the PMS REST API with their own token, for role and active.
// The TMS database is changed with the TMS's own service key (env TMS_SERVICE_ACCOUNT), never sent anywhere.
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

export const PMS_PROJECT = process.env.PMS_PROJECT_ID || 'widebed-pmsdashboard'
export const PMS_ROLES = ['director', 'finance', 'it', 'hr', 'operations', 'procurement', 'marketing']
export const TMS_ROLES = ['super_admin', 'dept_manager', 'employee']
// Same list as src/utils/constants.js DEPARTMENTS (the functions can't import from src/, which uses the browser SDK)
export const DEPARTMENT_IDS = ['director', 'management', 'hr', 'operation', 'finance', 'marketing', 'it', 'sales', 'procurement']
// Each person's department follows their PMS role (set at every sign-in). Same map as src/utils/constants.js
export const DEPT_FOR_PMS_ROLE = {
  director: 'director', finance: 'finance', it: 'it', hr: 'hr', operations: 'operation', procurement: 'procurement', marketing: 'marketing',
}
// The PMS AI Agent login (17 Nov 2026): a normal employee here, in its own department 'ai'
export const AI_ROLE = 'ai'
export const AI_DEPT_NAME = 'AI Agent'
// Role ids and department ids made from them: letters, digits, - and _ only (they become document ids)
export const ROLE_ID = /^[A-Za-z0-9_-]{1,64}$/
export const isCustomRole = (role) => !!role && !PMS_ROLES.includes(role) && role !== AI_ROLE
// A person's department follows their PMS role (17 Nov 2026, Khairul): built-in roles by the map above, a role made on
// the PMS Roles page (and the AI Agent) is its own department, with the role id as the department id.
export const deptForRole = (role) => (role ? DEPT_FOR_PMS_ROLE[role] ?? role : null)

// ----- Firebase (created on first use, so importing this file never needs credentials) -----
let services = null
export function getServices() {
  if (services) return services
  const pms = getApps().find((a) => a.name === 'pms') || initializeApp({ projectId: PMS_PROJECT }, 'pms')
  if (!process.env.TMS_SERVICE_ACCOUNT) throw new Error('TMS_SERVICE_ACCOUNT is not set')
  const tms = getApps().find((a) => a.name === 'tms')
    || initializeApp({ credential: cert(JSON.parse(process.env.TMS_SERVICE_ACCOUNT)) }, 'tms')
  services = {
    pmsAuth: getAuth(pms), tmsAuth: getAuth(tms), db: getFirestore(tms), messaging: getMessaging(tms), FieldValue, Timestamp,
    fetch: (...a) => fetch(...a),
  }
  return services
}
// Tests swap in fakes here
export const setServicesForTest = (s) => { services = s }

// An error with an HTTP status, turned into { error } by send()
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// ----- CORS: the PMS site(s) in ALLOWED_ORIGINS (comma list), plus this site itself (the TMS login page) -----
const allowedOrigins = () => (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)

function originAllowed(req, origin) {
  if (!origin) return false
  if (allowedOrigins().includes(origin)) return true
  try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host) } catch { return false }
}

// Returns false when the request is finished already (refused origin, preflight, wrong method)
export function cors(req, res) {
  const origin = req.headers.origin
  if (!originAllowed(req, origin)) { res.status(403).json({ error: 'Origin not allowed' }); return false }
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '600')
  if (req.method === 'OPTIONS') { res.status(204).end(); return false }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return false }
  return true
}

export function bodyOf(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  return req.body || {}
}

// ----- the PMS caller -----
const docUrl = (path) => `https://firestore.googleapis.com/v1/projects/${PMS_PROJECT}/databases/(default)/documents/${path}`

// Reads one PMS document as the caller (their own token, so PMS rules decide). null when missing or not allowed.
export async function readPmsDoc(path, idToken) {
  const r = await getServices().fetch(docUrl(path), { headers: { Authorization: `Bearer ${idToken}` } })
  if (!r.ok) return null
  return (await r.json()).fields || {}
}

// Is this PMS document gone? (13 Nov 2026, Owner Leads card delete) true only when the PMS answers "not found";
// any other answer (there, not allowed, PMS down) is false, so nothing is deleted on a guess.
export async function pmsDocGone(path, idToken) {
  const r = await getServices().fetch(docUrl(path), { headers: { Authorization: `Bearer ${idToken}` } })
  return r.status === 404
}

// A PMS staff record in plain JS: { role, active, name, email }
export function staffFrom(fields) {
  const role = fields.role?.stringValue || null
  return {
    // Built-in roles, roles made on the PMS Roles page and the AI Agent (17 Nov 2026: was built-in roles only)
    role: role && ROLE_ID.test(role) ? role : null,
    active: fields.active?.booleanValue !== false,
    name: fields.displayName?.stringValue || '',
    email: fields.email?.stringValue || '',
  }
}

// A role made on the PMS Roles page, from PMS roles/{id} read as the caller: { name, active }, or null when it is gone
export async function pmsRoleInfo(role, idToken) {
  if (!isCustomRole(role) || !ROLE_ID.test(role)) return null
  const f = await readPmsDoc(`roles/${role}`, idToken)
  if (!f) return null
  return { name: f.name?.stringValue || role, active: f.active?.booleanValue !== false }
}

// The name of a department made from a PMS role (custom roles and the AI Agent), else null
export async function deptNameFor(role, idToken) {
  if (role === AI_ROLE) return AI_DEPT_NAME
  return (await pmsRoleInfo(role, idToken))?.name ?? null
}

// May a task be put in this department? The fixed TMS departments, the AI Agent's, or an active PMS custom role.
export async function departmentExists(id, idToken) {
  if (DEPARTMENT_IDS.includes(id) || id === AI_ROLE) return true
  const info = await pmsRoleInfo(id, idToken)
  return !!info && info.active
}

// Checks the token and the staff record. Throws 401 (not a PMS login) or 403 (switched off / no role).
// A role made on the PMS Roles page must still exist there and be switched on, as for the PMS sign-in.
export async function pmsUser(req) {
  const idToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!idToken) throw new HttpError(401, 'Not signed in to the PMS')
  let decoded
  // The key is loaded first, so a missing or broken TMS_SERVICE_ACCOUNT isn't reported as a bad login
  let services
  try { services = getServices() } catch (e) { console.error('TMS key:', e.message); throw new HttpError(500, 'Task system key missing or invalid (TMS_SERVICE_ACCOUNT)') }
  try { decoded = await services.pmsAuth.verifyIdToken(idToken) } catch { throw new HttpError(401, 'Not signed in to the PMS') }
  const fields = await readPmsDoc(`users/${decoded.uid}`, idToken)
  if (!fields) throw new HttpError(403, 'No PMS staff record for this account')
  const s = staffFrom(fields)
  if (!s.active || !s.role) throw new HttpError(403, 'This PMS account is switched off or has no role')
  let roleName = null
  if (isCustomRole(s.role)) {
    const info = await pmsRoleInfo(s.role, idToken)
    if (!info || !info.active) throw new HttpError(403, 'This PMS role is switched off or was removed')
    roleName = info.name
  } else if (s.role === AI_ROLE) roleName = AI_DEPT_NAME
  return { uid: decoded.uid, idToken, role: s.role, roleName, name: s.name || decoded.email || 'PMS staff', email: decoded.email || s.email || '' }
}

// Wraps a handler: CORS, then errors become JSON. `fn` returns the JSON reply.
export function handle(fn) {
  return async (req, res) => {
    if (!cors(req, res)) return
    try {
      res.status(200).json(await fn(req, res))
    } catch (e) {
      if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
      console.error(e)
      res.status(500).json({ error: 'Task system error' })
    }
  }
}

// ----- small text helpers -----
export const text = (v, max) => String(v ?? '').trim().slice(0, max)
