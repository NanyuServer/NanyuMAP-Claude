'use client'
// src/app/admin/feedback/page.tsx
// 用户反馈管理：查看用户提交的意见反馈，可删除
import { useState, useEffect, useCallback } from 'react'
import { RefreshCcw, Trash2, MessageSquare, Inbox } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

interface FeedbackItem {
  id: number
  type: string
  description: string
  phone: string | null
  createdAt: string
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  '功能意见': { bg: 'rgba(0,122,255,0.12)', color: '#60A5FA' },
  '界面意见': { bg: 'rgba(168,85,247,0.12)', color: '#C084FC' },
  '新的需求': { bg: 'rgba(52,199,89,0.12)', color: '#4ADE80' },
  '其他': { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' },
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return iso }
}

export default function FeedbackPage() {
  const [list, setList] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setList(Array.isArray(data) ? data : [])
      }
    } catch { /* 忽略 */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条反馈吗？')) return
    try {
      await fetch(`/api/feedback?id=${id}`, { method: 'DELETE', credentials: 'same-origin' })
      setList(prev => prev.filter(f => f.id !== id))
    } catch { alert('删除失败') }
  }

  return (
    <AdminShell>
      <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080809' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.95)' }}>
          <div>
            <h1 className="text-white text-base font-semibold">用户反馈</h1>
            <p className="text-white/35 text-xs mt-0.5">查看用户提交的意见反馈（共 {list.length} 条）</p>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 text-sm">
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 统计 */}
        <div className="flex gap-3 px-6 pt-4 flex-shrink-0">
          <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
            <div className="text-white/35 text-[11px]">全部反馈</div>
            <div className="text-white text-xl font-semibold mt-0.5">{list.length}</div>
          </div>
          {Object.entries(TYPE_COLORS).map(([type, c]) => {
            const count = list.filter(f => f.type === type).length
            return (
              <div key={type} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3">
                <div className="text-[11px]" style={{ color: c.color }}>{type}</div>
                <div className="text-white text-xl font-semibold mt-0.5">{count}</div>
              </div>
            )
          })}
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-white/30 text-sm">加载中…</div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3">
              <Inbox size={36} className="text-white/15" />
              <div className="text-white/30 text-sm">暂无用户反馈</div>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map(f => {
                const c = TYPE_COLORS[f.type] || TYPE_COLORS['其他']
                return (
                  <div key={f.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.bg }}>
                      <MessageSquare size={14} style={{ color: c.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: c.bg, color: c.color }}>{f.type}</span>
                        <span className="text-white/30 text-[11px]">{formatTime(f.createdAt)}</span>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap break-words">{f.description}</p>
                      {f.phone && (
                        <div className="mt-2 text-white/40 text-xs">联系方式：{f.phone}</div>
                      )}
                    </div>
                    <button onClick={() => handleDelete(f.id)} className="text-white/25 hover:text-red-400 transition-colors flex-shrink-0 mt-1" title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
