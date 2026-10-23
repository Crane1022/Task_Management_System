import test from 'node:test'
import assert from 'node:assert/strict'
import { effectiveBoardRole, legacyBoardRole, canEdit, canManage, leavesAnAdmin } from '../src/utils/permissions.js'

test('a Director is admin on every board, even without being a member', () => {
  assert.equal(effectiveBoardRole({ isDirector: true, workspaceRole: 'none' }), 'admin')
})
test('someone who is not in the workspace has no access', () => {
  assert.equal(effectiveBoardRole({ workspaceRole: undefined }), 'none')
  assert.equal(effectiveBoardRole({ workspaceRole: 'none', boardOverride: 'admin' }), 'none') // an override cannot grant access
})
test('workspace admins are admins on every board and cannot be lowered by a board override', () => {
  assert.equal(effectiveBoardRole({ workspaceRole: 'admin', boardOverride: 'viewer' }), 'admin')
})
test('a board can lower or raise a member', () => {
  assert.equal(effectiveBoardRole({ workspaceRole: 'member' }), 'member')
  assert.equal(effectiveBoardRole({ workspaceRole: 'member', boardOverride: 'viewer' }), 'viewer')
  assert.equal(effectiveBoardRole({ workspaceRole: 'viewer', boardOverride: 'admin' }), 'admin')
})
test('viewers can look but not edit; only admins manage', () => {
  assert.equal(canEdit('viewer'), false)
  assert.equal(canEdit('member'), true)
  assert.equal(canManage('member'), false)
  assert.equal(canManage('admin'), true)
  assert.equal(canEdit('none'), false)
})
test('the original board keeps its old rules: Directors and managers manage, others work', () => {
  assert.equal(legacyBoardRole({ isDirector: true }), 'admin')
  assert.equal(legacyBoardRole({ canManage: true }), 'admin')
  assert.equal(legacyBoardRole({}), 'member')
})
test('a workspace can never lose its last admin', () => {
  const members = { a: 'admin', b: 'member' }
  assert.equal(leavesAnAdmin(members, 'a', 'member'), false)
  assert.equal(leavesAnAdmin(members, 'a', null), false)
  assert.equal(leavesAnAdmin(members, 'b', null), true)
  assert.equal(leavesAnAdmin({ a: 'admin', c: 'admin' }, 'a', null), true)
})
