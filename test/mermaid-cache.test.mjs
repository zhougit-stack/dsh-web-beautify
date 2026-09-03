// mermaid 静态端点单测：首 GET 200（带 ETag + 全量 body）、If-None-Match 命中 304、失配重传、非 loopback 403
import { mermaidHandler } from '../lib/index.js'

const mk = () => {
  const chunks = []
  const res = { writeHead: (s, h) => { res._status = s; res._headers = h }, end: (b) => { if (b) chunks.push(b) } }
  return { res, chunks }
}
const call = async (reqExtra = {}) => {
  const { res, chunks } = mk()
  const req = { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: {}, url: '/plugins/dsh-web-beautify/mermaid.min.js', ...reqExtra }
  await mermaidHandler(req, res)
  let body
  try { body = JSON.parse(chunks.join('')) } catch { body = Buffer.concat(chunks) }
  return { status: res._status, headers: res._headers, body }
}

let failed = 0
const fail = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + extra)); if (!cond) failed = 1 }

const r1 = await call()
fail('first GET 200 + etag + full body', r1.status === 200 && !!r1.headers?.etag && r1.body.length > 1_000_000, `status=${r1.status} len=${r1.body.length}`)

const r2 = await call({ headers: { 'if-none-match': r1.headers.etag } })
fail('If-None-Match hit -> 304 empty body', r2.status === 304 && r2.body.length === 0, `status=${r2.status} len=${r2.body.length}`)

const r3 = await call({ headers: { 'if-none-match': '"bogus"' } })
fail('etag mismatch -> 200 full body again', r3.status === 200 && r3.body.length > 1_000_000, `status=${r3.status}`)

const r4 = await call({ socket: { remoteAddress: '8.8.8.8' } })
fail('non-loopback -> 403', r4.status === 403, `status=${r4.status}`)

process.exit(failed ? 1 : 0)
