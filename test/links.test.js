import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLink, providerOf, kindOf, isSafeHref, nameFromUrl, MAX_ATTACHMENTS } from '../src/utils/links.js'

test('links from the supported services are recognised', () => {
  const cases = [
    ['https://drive.google.com/file/d/1AbC/view?usp=sharing', 'Google Drive'],
    ['https://docs.google.com/spreadsheets/d/1AbC/edit', 'Google Drive'],
    ['https://1drv.ms/b/s!AbC', 'OneDrive'],
    ['https://onedrive.live.com/redir?resid=1', 'OneDrive'],
    ['https://widebed-my.sharepoint.com/:w:/g/personal/ana/Report.docx', 'SharePoint'],
    ['https://www.dropbox.com/s/abc/plan.pdf?dl=0', 'Dropbox'],
    ['https://example.com/files/x.pdf', 'Web link'],
    ['http://fileserver/projects/Quote.xlsx', 'Company file server'],
    ['https://nas.widebed.local/share/a.pdf', 'Company file server'],
  ]
  for (const [url, provider] of cases) assert.equal(parseLink(url).provider, provider, url)
  assert.equal(parseLink('https://files.widebed.com.my/a.pdf', '', ['widebed.com.my']).provider, 'Company file server') // a configured company host
})

test('the name and the kind of file come from the link, or from what the person typed', () => {
  const a = parseLink('https://widebed.sharepoint.com/sites/ops/Shared%20Documents/Inspection%20Report.pdf?web=1')
  assert.equal(a.name, 'Inspection Report.pdf'); assert.equal(a.kind, 'pdf')
  assert.equal(parseLink('https://example.com/x', 'Quotation (final)').name, 'Quotation (final)')
  assert.equal(parseLink('https://example.com/').name, 'example.com')
  assert.equal(parseLink('https://drive.google.com/file/d/1/view', 'Budget.xlsx').kind, 'excel')
  for (const [n, k] of [['a.docx', 'word'], ['a.PNG', 'image'], ['a.pptx', 'slides'], ['a.zip', 'archive'], ['a', 'other']]) assert.equal(kindOf(n), k, n)
})

test('a link typed without https:// still works', () => {
  assert.equal(parseLink('drive.google.com/file/d/1/view').url, 'https://drive.google.com/file/d/1/view')
})

test('unsafe or unusable links are refused with a clear message', () => {
  const bad = ['', '   ', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'file:///C:/secret.docx', 'ftp://example.com/a.pdf',
    'https://user:pass@example.com/a.pdf', '\\\\fileserver\\projects\\a.docx', 'C:\\Users\\ana\\a.docx', 'https://' + 'a'.repeat(2100), 'not a link at all']
  for (const b of bad) { const r = parseLink(b); assert.ok(r.error, `accepted: ${b.slice(0, 40)}`); assert.equal(r.url, undefined) }
  assert.match(parseLink('\\\\fileserver\\x').error, /cannot be opened from a browser/)
  assert.match(parseLink('https://u:p@example.com/a').error, /user name and password/)
})

test('only web links are ever turned into clickable links when shown', () => {
  assert.equal(isSafeHref('https://example.com'), true)
  assert.equal(isSafeHref('http://fileserver/a.pdf'), true)
  for (const u of ['javascript:alert(1)', 'data:text/html,1', 'file:///a', '', 'nonsense']) assert.equal(isSafeHref(u), false, u)
  assert.equal(MAX_ATTACHMENTS, 30)
  assert.equal(nameFromUrl(new URL('https://a.com/x/y%20z.pdf')), 'y z.pdf')
})
