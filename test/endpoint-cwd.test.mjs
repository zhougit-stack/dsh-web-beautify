// 临时端点单测：相对路径按 ?cwd= 解析，缺省退 workspace，绝对路径原样
import { createFileHandler } from '../lib/index.js'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = mkdtempSync(join(tmpdir(), 'pnb-cwd-'))
writeFileSync(join(tmp, 'pelican-bicycle.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')

const handler = createFileHandler()
const call = async (qs) => {
  const chunks = []
  const res = {
    writeHead: (status) => { res._status = status },
    end: (b) => { chunks.push(b) },
  }
  const req = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
    url: '/plugins/dsh-web-beautify/file?' + qs,
  }
  await handler(req, res)
  let body
  try { body = JSON.parse(chunks.join('')) } catch { body = chunks.join('').slice(0, 80) }
  return { status: res._status, body }
}

const enc = encodeURIComponent

const fail = (name, cond, extra) => {
  console.log(cond ? `PASS ${name}` : `FAIL ${name} ${extra || ''}`)
  if (!cond) process.exitCode = 1
}

// 1. 相对路径 + cwd → 解析到会话工作目录里的文件（svg 走 image 分支）
const r1 = await call(`path=${enc('pelican-bicycle.svg')}&cwd=${enc(tmp)}`)
fail('relative+cwd resolves into session cwd', r1.status === 200 && r1.body.kind === 'image' && r1.body.path === join(tmp, 'pelican-bicycle.svg'), JSON.stringify(r1.body))

// 2. 相对路径无 cwd → 退 .dsh/workspace，应 404
const r2 = await call(`path=${enc('pelican-bicycle.svg')}`)
fail('relative w/o cwd falls back to workspace', r2.status === 404 && /workspace/.test(r2.body.path || ''), JSON.stringify(r2.body))

// 3. 绝对路径不受影响
const r3 = await call(`path=${enc('C:/Users/Administrator/.claude/workspace/CODE_MAP.md')}`)
fail('absolute path unchanged', r3.status === 200 && r3.body.kind === 'text' && /CODE_MAP\.md$/.test(r3.body.path || ''), JSON.stringify(r3.body))

// 4. cwd 指向不存在的目录 → 退 workspace 404
const r4 = await call(`path=${enc('pelican-bicycle.svg')}&cwd=${enc(join(tmp, 'no', 'such'))}`)
fail('bad cwd falls back', r4.status === 404, JSON.stringify(r4.body))

// 5. cwd 命中但文件不在 → 404
const r5 = await call(`path=${enc('missing-file-xyz.svg')}&cwd=${enc(tmp)}`)
fail('cwd hit but file missing', r5.status === 404, JSON.stringify(r5.body))

// 6. 非绝对 cwd 参数被忽略 → 退 workspace 404
const r6 = await call(`path=${enc('pelican-bicycle.svg')}&cwd=relative/dir`)
fail('non-absolute cwd ignored', r6.status === 404 && /workspace/.test(r6.body.path || ''), JSON.stringify(r6.body))

rmSync(tmp, { recursive: true, force: true })
