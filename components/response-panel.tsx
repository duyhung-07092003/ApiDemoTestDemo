'use client'

import { Check, Code2, FileWarning, LoaderCircle } from 'lucide-react'

type Result = { status: number; statusText: string; duration: number; size: number; headers: Record<string, string>; body: string; ok: boolean; simulated?: boolean } | null

const jsonTokenPattern = /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/g

export function HighlightedJson({ text }: { text: string }) {
  return <>{text.split(jsonTokenPattern).map((token, index) => {
    if (!token) return null
    const className = /^"(?:\\.|[^"\\])*"\s*:$/.test(token)
      ? 'json-key'
      : /^"/.test(token)
        ? 'json-string'
        : /^-?\d/.test(token)
          ? 'json-number'
          : /^(true|false|null)$/.test(token)
            ? 'json-literal'
            : undefined
    return className ? <span className={className} key={index}>{token}</span> : token
  })}</>
}

export function ResponsePanel({ result, error, loading }: { result: Result; error: string; loading: boolean }) {
  if (loading) return <div className="response-empty"><span className="empty-icon loading-icon"><LoaderCircle size={21} /></span><strong>Đang gửi request…</strong><p>Đang chờ phản hồi từ endpoint.</p></div>
  if (error) return <div className="response-empty"><span className="empty-icon error-icon"><FileWarning size={20} /></span><strong>Không thể hoàn tất request</strong><p>{error}</p></div>
  if (!result) return <div className="response-empty"><span className="empty-icon"><Code2 size={20} /></span><strong>Response sẽ xuất hiện tại đây</strong><p>Cấu hình endpoint và nhấn <b>Gửi request</b> để bắt đầu.</p><span className="empty-hint"><Check size={12} /> Hỗ trợ JSON, text và response headers</span></div>
  let formatted = result.body
  let isJsonResponse = false
  try {
    formatted = JSON.stringify(JSON.parse(result.body), null, 2)
    isJsonResponse = true
  } catch { /* Keep non-JSON responses readable as plain text. */ }
  return <div className="response-result"><div className="response-body-heading"><span>{isJsonResponse ? 'JSON' : 'BODY'}{result.simulated ? ' · MÔ PHỎNG' : ''}</span><span>{result.body.split('\n').length} lines</span></div><pre className="response-code">{isJsonResponse ? <HighlightedJson text={formatted || 'null'} /> : formatted || '(empty response body)'}</pre><details className="response-headers"><summary>Response headers <span>{Object.keys(result.headers).length}</span></summary><div>{Object.entries(result.headers).map(([key, value]) => <div className="response-header" key={key}><code>{key}</code><span>{value}</span></div>)}</div></details></div>
}
