/**
 * @zhougit-stack/dsh-web-beautify — 服务端
 *
 * 挂两个 loopback-only 端点：
 *   GET /plugins/dsh-web-beautify/file?path=<文件路径>
 *     预览面板读取消息里引用的本地文件；
 *   GET /plugins/dsh-web-beautify/mermaid.min.js
 *     预览面板 mermaid 图表渲染库（静态资源，进程内缓存）。
 *
 * 安全边界（对齐 dsh-agent-mode 的成熟做法）：
 *   - 仅接受 loopback 来源 + Origin/Host 同源校验（web UI 本身无鉴权，不放大）；
 *   - 只读、单文件、2MB 封顶、无目录列举、无写入；
 *   - 相对路径按 ?cwd=（当前会话工作目录，客户端从 React props.cwd 取确切值）
 *     解析，缺省/未命中退 $DSH_HOME/workspace；绝对路径原样使用。
 */
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve, extname } from 'node:path';

export const FILE_ENDPOINT = '/plugins/dsh-web-beautify/file';

/** 预览面板 mermaid 渲染库（客户端首用到才拉取一次的静态资源）。 */
export const MERMAID_ENDPOINT = '/plugins/dsh-web-beautify/mermaid.min.js';

/** 单次读取上限（字节）；超出直接拒绝，前端提示文件过大。 */
const MAX_BYTES = 2 * 1024 * 1024;
/** 文本内容回传上限（字符）；超限截断并标记 truncated。 */
const MAX_TEXT_CHARS = 400_000;

const IMAGE_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif',
};

/** ?raw=1 时允许原样回流的类型（浏览器自带渲染器：PDF 内嵌预览）。 */
const RAW_TYPES = { '.pdf': 'application/pdf' };
/** raw 模式上限（PDF 通常比文本大得多）。 */
const MAX_RAW_BYTES = 30 * 1024 * 1024;

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isLoopback(address) {
  if (!address) return false;
  const host = address.replace(/^::ffff:/, '');
  return host === '127.0.0.1' || host === '::1' || host === 'localhost';
}

/** $DSH_HOME/workspace：相对路径的唯一解析根（不依赖 peer 包，env 缺失时回退 ~/.dsh）。 */
function workspaceRoot() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'workspace');
}

/** mermaid 库静态服务：loopback-only 只读单文件（内容 + etag 进程内缓存；
 *  no-cache + ETag：重载走 304 重校验，内容不变不重传 2.75MB body）。 */
let mermaidCache = null;
async function mermaidLoad() {
  if (mermaidCache) return mermaidCache;
  const u = new URL('./mermaid.min.js', import.meta.url);
  const [buf, st] = await Promise.all([readFile(u), stat(u)]);
  mermaidCache = { buf, etag: `"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"` };
  return mermaidCache;
}
export async function mermaidHandler(req, res) {
  if (!isLoopback(req.socket?.remoteAddress)) {
    jsonResponse(res, 403, { error: 'local access only' });
    return;
  }
  if (req.method !== 'GET') {
    jsonResponse(res, 405, { error: 'method not allowed' });
    return;
  }
  try {
    const { buf, etag } = await mermaidLoad();
    if (req.headers?.['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': 'no-cache' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'content-length': buf.length,
      'cache-control': 'no-cache',
      etag,
    });
    res.end(buf);
  } catch {
    jsonResponse(res, 404, { error: 'mermaid.min.js 未随插件安装' });
  }
}

export function createFileHandler() {
  return async (req, res) => {
    if (!isLoopback(req.socket?.remoteAddress)) {
      jsonResponse(res, 403, { error: 'local access only' });
      return;
    }
    const origin = req.headers?.origin;
    if (origin) {
      let originHost;
      try { originHost = new URL(origin).host; } catch {}
      if (!originHost || originHost !== req.headers.host) {
        jsonResponse(res, 403, { error: 'origin mismatch' });
        return;
      }
    }
    if (req.method !== 'GET') {
      jsonResponse(res, 405, { error: 'method not allowed' });
      return;
    }
    let url;
    try {
      url = new URL(req.url, 'http://loopback');
    } catch {
      jsonResponse(res, 400, { error: 'bad request url' });
      return;
    }
    const raw = url.searchParams.get('path') ?? '';
    if (!raw.trim()) {
      jsonResponse(res, 400, { error: 'missing ?path=' });
      return;
    }
    // 去掉客户端可能带上的 file:// 前缀与首尾引号/空白（消息文本里常见）。
    const cleaned = raw.trim().replace(/^file:\/\//i, '').replace(/^["'`]|["'`]$/g, '');
    // 相对路径解析根：优先 ?cwd=（客户端从当前会话消息里的绝对路径推断的
    // 会话工作目录），找不到再退 $DSH_HOME/workspace。绝对路径原样使用。
    let target;
    if (isAbsolute(cleaned)) {
      target = resolve(cleaned);
    } else {
      const cwdParam = url.searchParams.get('cwd');
      const bases = [];
      if (cwdParam && isAbsolute(cwdParam)) bases.push(resolve(cwdParam));
      bases.push(workspaceRoot());
      target = null;
      for (const base of bases) {
        const t = resolve(base, cleaned);
        try {
          if ((await stat(t)).isFile()) { target = t; break; }
        } catch {}
      }
      if (!target) target = resolve(bases[bases.length - 1], cleaned);
    }
    let info;
    try {
      info = await stat(target);
    } catch {
      jsonResponse(res, 404, { error: '文件不存在', path: target });
      return;
    }
    if (!info.isFile()) {
      jsonResponse(res, 400, { error: '不是普通文件（可能是目录）', path: target });
      return;
    }
    if (info.size > MAX_BYTES) {
      jsonResponse(res, 413, { error: `文件过大（${info.size} 字节，上限 ${MAX_BYTES}）`, path: target });
      return;
    }
    const ext = extname(target).toLowerCase();
    // raw 模式：按原始字节 + Content-Type 回流（PDF 交给浏览器内置查看器内嵌渲染）
    const wantRaw = url.searchParams.get('raw') === '1';
    if (wantRaw && RAW_TYPES[ext]) {
      if (info.size > MAX_RAW_BYTES) {
        jsonResponse(res, 413, { error: `文件过大（${info.size} 字节，raw 上限 ${MAX_RAW_BYTES}）`, path: target });
        return;
      }
      try {
        const buf = await readFile(target);
        res.writeHead(200, {
          'content-type': RAW_TYPES[ext],
          'content-length': buf.length,
          'content-disposition': 'inline',
          'cache-control': 'no-store',
        });
        res.end(buf);
      } catch (error) {
        jsonResponse(res, 500, { error: String(error), path: target });
      }
      return;
    }
    if (IMAGE_TYPES[ext]) {
      try {
        const buf = await readFile(target);
        jsonResponse(res, 200, {
          kind: 'image', path: target, size: info.size,
          dataUrl: `data:${IMAGE_TYPES[ext]};base64,${buf.toString('base64')}`,
        });
      } catch (error) {
        jsonResponse(res, 500, { error: String(error), path: target });
      }
      return;
    }
    try {
      const buf = await readFile(target);
      // 二进制探测：前 8KB 出现 NUL 字节即按二进制拒绝（不做十六进制预览，保持最小实现）。
      if (buf.subarray(0, 8192).includes(0)) {
        jsonResponse(res, 415, { error: '二进制文件，暂不支持预览', path: target, size: info.size });
        return;
      }
      const text = buf.toString('utf8');
      const truncated = text.length > MAX_TEXT_CHARS;
      jsonResponse(res, 200, {
        kind: 'text', path: target, size: info.size,
        content: truncated ? text.slice(0, MAX_TEXT_CHARS) : text,
        truncated,
      });
    } catch (error) {
      jsonResponse(res, 500, { error: String(error), path: target });
    }
  };
}

export default {
  name: 'dsh-web-beautify',
  inject: ['webServer'],
  apply(ctx) {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['webServer'], (httpCtx) => {
        httpCtx.effect(
          () => {
            httpCtx.webServer.register({ kind: 'exact', path: FILE_ENDPOINT, handler: createFileHandler() });
            httpCtx.webServer.register({ kind: 'exact', path: MERMAID_ENDPOINT, handler: mermaidHandler });
          },
          'dsh-web-beautify: file preview + mermaid endpoints',
        );
      });
      return;
    }
    // 宿主缺少 webServer 时静默跳过：钢琴键导航不依赖端点，仍可用。
  },
};
