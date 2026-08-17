'use client'
// src/app/admin/system/page.tsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Settings, Save, Download, Trash2, Key, AlertTriangle, Check, Loader2, Ruler } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'

const MAP_NATURAL: Record<string, { w: number; h: number }> = {
  junior: { w: 1560, h: 1008 },
  senior: { w: 1536, h: 1024 },
}

export default function SystemPage() {
  const [systemVersion, setSystemVersion] = useState('')
  const [databaseVersion, setDatabaseVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetText, setResetText] = useState('')
  const [resetting, setResetting] = useState(false)

  const [downloading, setDownloading] = useState(false)

  const [scaleCampus, setScaleCampus] = useState<'junior' | 'senior'>('junior')
  const [scaleLine, setScaleLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [scaleDrawing, setScaleDrawing] = useState(false)
  const [scalePoint1, setScalePoint1] = useState<{ x: number; y: number } | null>(null)
  const [realDistance, setRealDistance] = useState('')
  const [scaleResult, setScaleResult] = useState('')
  const [scaleSaving, setScaleSaving] = useState(false)
  const [scaleMsg, setScaleMsg] = useState('')
  const [savedScales, setSavedScales] = useState<{ junior: string; senior: string }>({ junior: '', senior: '' })
  const scaleMapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/system/settings')
      .then(r => r.json())
      .then(data => {
        setSystemVersion(data.systemVersion || '1.0.0')
        setDatabaseVersion(data.databaseVersion || 'PostgreSQL 16')
        setSavedScales({ junior: data.juniorScale || '', senior: data.seniorScale || '' })
      })
      .catch(() => {})
  }, [])

  const handleSaveVersions = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ systemVersion, databaseVersion }),
      })
      if (!res.ok) throw new Error('保存失败')
      setSaveMsg('保存成功')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleBackup = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/system/backup', { credentials: 'same-origin' })
      if (!res.ok) throw new Error('备份失败')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nanyu-nav-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('备份失败')
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = async () => {
    if (resetText !== '确认删除所有数据') return
    setResetting(true)
    try {
      const res = await fetch('/api/system/reset', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('重置失败')
      alert('所有数据已删除')
      setResetConfirm(false)
      setResetText('')
    } catch {
      alert('重置失败')
    } finally {
      setResetting(false)
    }
  }

  const handleChangePassword = async () => {
    setPwSaving(true)
    setPwMsg('')
    setPwError('')
    try {
      const res = await fetch('/api/system/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentPassword: currentPw,
          newUsername: newUsername || undefined,
          newPassword: newPw,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '修改失败')
      setPwMsg('账号信息已更新，请重新登录')
      setCurrentPw('')
      setNewUsername('')
      setNewPw('')
    } catch (e) {
      setPwError(e instanceof Error ? e.message : '修改失败')
    } finally {
      setPwSaving(false)
    }
  }

  const sectionStyle = {
    background: 'rgba(16,16,22,0.95)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
  }

  return (
    <AdminShell>
      <div className="h-full flex flex-col admin-scroll" style={{ background: '#0a0a0c' }}>
        <div className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,14,0.8)' }}>
          <div>
            <h1 className="text-white text-lg font-semibold">系统操作</h1>
            <p className="text-white/35 text-xs mt-0.5">管理系统版本、数据库和账号</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-3xl">

          {/* 版本设置 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={sectionStyle}>
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Settings size={16} className="text-blue-400" />
              <h2 className="text-white font-semibold text-sm">版本信息设置</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-white/50 text-xs font-medium mb-2 block">系统版本</label>
                <input
                  value={systemVersion}
                  onChange={e => setSystemVersion(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                  placeholder="例：1.0.0"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium mb-2 block">数据库版本</label>
                <input
                  value={databaseVersion}
                  onChange={e => setDatabaseVersion(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                  placeholder="例：PostgreSQL 16"
                />
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSaveVersions}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#007AFF,#005DC1)', boxShadow: '0 4px 12px rgba(0,122,255,0.25)', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? '保存中...' : '保存设置'}
                </motion.button>
                {saveMsg && (
                  <span className={`text-xs ${saveMsg === '保存成功' ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg}</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* 数据库操作 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={sectionStyle}>
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Download size={16} className="text-emerald-400" />
              <h2 className="text-white font-semibold text-sm">数据库操作</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <div className="text-white/80 text-sm font-medium">备份数据库</div>
                  <div className="text-white/35 text-xs mt-0.5">下载所有地点、道路和系统设置数据</div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBackup}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)', boxShadow: '0 4px 12px rgba(34,197,94,0.18)', opacity: downloading ? 0.6 : 1 }}
                >
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {downloading ? '下载中...' : '下载备份'}
                </motion.button>
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.12)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-red-400 text-sm font-medium">删除所有数据</div>
                    <div className="text-white/35 text-xs mt-0.5">此操作不可恢复，请先备份数据</div>
                  </div>
                  {!resetConfirm ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setResetConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 text-sm font-medium"
                      style={{ background: 'rgba(255,59,48,0.1)' }}
                    >
                      <Trash2 size={14} />
                      删除数据
                    </motion.button>
                  ) : null}
                </div>
                {resetConfirm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'rgba(255,59,48,0.08)' }}>
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-300 text-xs leading-relaxed">
                        即将删除所有地点、道路节点、路径、分类和系统设置数据。此操作不可恢复。请输入 <span className="font-mono font-bold text-red-200">确认删除所有数据</span> 来确认操作。
                      </p>
                    </div>
                    <input
                      value={resetText}
                      onChange={e => setResetText(e.target.value)}
                      placeholder='输入"确认删除所有数据"'
                      className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,59,48,0.2)', outline: 'none' }}
                    />
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleReset}
                        disabled={resetText !== '确认删除所有数据' || resetting}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                        style={{
                          background: resetText === '确认删除所有数据' ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'rgba(255,255,255,0.05)',
                          opacity: resetText === '确认删除所有数据' && !resetting ? 1 : 0.5,
                        }}
                      >
                        {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {resetting ? '删除中...' : '确认删除'}
                      </motion.button>
                      <button
                        onClick={() => { setResetConfirm(false); setResetText('') }}
                        className="px-4 py-2 rounded-xl text-white/50 text-sm"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        取消
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* 修改账号 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={sectionStyle}>
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Key size={16} className="text-violet-400" />
              <h2 className="text-white font-semibold text-sm">修改登录信息</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-white/50 text-xs font-medium mb-2 block">当前密码 *</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                  placeholder="输入当前密码"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium mb-2 block">新用户名 <span className="text-white/30">（留空则不修改）</span></label>
                <input
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                  placeholder="输入新用户名"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs font-medium mb-2 block">新密码 *</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                  placeholder="输入新密码（至少6位）"
                />
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleChangePassword}
                  disabled={pwSaving || !currentPw || !newPw}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                  style={{
                    background: 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                    boxShadow: '0 4px 12px rgba(139,92,246,0.25)',
                    opacity: pwSaving || !currentPw || !newPw ? 0.5 : 1,
                  }}
                >
                  {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {pwSaving ? '修改中...' : '确认修改'}
                </motion.button>
                {pwMsg && <span className="text-emerald-400 text-xs">{pwMsg}</span>}
                {pwError && <span className="text-red-400 text-xs">{pwError}</span>}
              </div>
            </div>
          </motion.div>

          {/* 比例尺设置 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={sectionStyle}>
            <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <Ruler size={16} className="text-cyan-400" />
              <h2 className="text-white font-semibold text-sm">比例尺设置</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                {(['junior', 'senior'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => { setScaleCampus(c); setScaleLine(null); setScalePoint1(null); setScaleResult(''); setRealDistance('') }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: scaleCampus === c ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: scaleCampus === c ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      color: scaleCampus === c ? '#60A5FA' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {c === 'junior' ? '初中部' : '高中部'}
                    {savedScales[c] && <span className="ml-2 text-xs opacity-60">({savedScales[c]})</span>}
                  </button>
                ))}
              </div>

              <div className="text-white/40 text-xs">
                在下方地图上点击两个点画一条直线，输入该线段在现实中的距离（米），系统自动计算比例尺。
              </div>

              <div
                ref={scaleMapRef}
                className="relative rounded-xl overflow-hidden cursor-crosshair"
                style={{ width: '100%', aspectRatio: `${MAP_NATURAL[scaleCampus].w / MAP_NATURAL[scaleCampus].h}`, border: '1px solid rgba(255,255,255,0.1)', background: '#111' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const px = ((e.clientX - rect.left) / rect.width) * 100
                  const py = ((e.clientY - rect.top) / rect.height) * 100
                  if (!scalePoint1) {
                    setScalePoint1({ x: px, y: py })
                    setScaleDrawing(true)
                    setScaleLine(null)
                    setScaleResult('')
                  } else {
                    setScaleLine({ x1: scalePoint1.x, y1: scalePoint1.y, x2: px, y2: py })
                    setScalePoint1(null)
                    setScaleDrawing(false)
                    const natural = MAP_NATURAL[scaleCampus]
                    const dx = (px - scalePoint1.x) / 100 * natural.w
                    const dy = (py - scalePoint1.y) / 100 * natural.h
                    const pixelDist = Math.sqrt(dx * dx + dy * dy)
                    setScaleResult(`像素距离: ${pixelDist.toFixed(1)}px`)
                  }
                }}
              >
                <img
                  src={scaleCampus === 'junior' ? '/assets/map.webp' : '/assets/map2-0.webp'}
                  alt="地图"
                  style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
                  draggable={false}
                />
                {scalePoint1 && (
                  <div style={{ position: 'absolute', left: `${scalePoint1.x}%`, top: `${scalePoint1.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#06B6D4', border: '2px solid white', boxShadow: '0 1px 4px rgba(6,182,212,0.5)' }} />
                )}
                {scaleLine && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <line x1={`${scaleLine.x1}%`} y1={`${scaleLine.y1}%`} x2={`${scaleLine.x2}%`} y2={`${scaleLine.y2}%`} stroke="#06B6D4" strokeWidth="2" strokeDasharray="6 3" />
                    <circle cx={`${scaleLine.x1}%`} cy={`${scaleLine.y1}%`} r="5" fill="#06B6D4" stroke="white" strokeWidth="2" />
                    <circle cx={`${scaleLine.x2}%`} cy={`${scaleLine.y2}%`} r="5" fill="#06B6D4" stroke="white" strokeWidth="2" />
                  </svg>
                )}
                {scaleDrawing && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)' }}>
                    点击地图设置第二个点
                  </div>
                )}
              </div>

              {scaleLine && (
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-white/50 text-xs font-medium mb-2 block">现实距离（米）</label>
                    <input
                      value={realDistance}
                      onChange={e => setRealDistance(e.target.value)}
                      type="number"
                      step="0.1"
                      className="w-full py-2.5 px-3 rounded-xl text-white/90 text-sm"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
                      placeholder="输入该线段在现实中的距离"
                    />
                  </div>
                  <div className="text-white/40 text-xs pb-3">{scaleResult}</div>
                </div>
              )}

              {scaleLine && realDistance && (
                <div className="flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={async () => {
                      setScaleSaving(true); setScaleMsg('')
                      try {
                        const natural = MAP_NATURAL[scaleCampus]
                        const dx = (scaleLine.x2 - scaleLine.x1) / 100 * natural.w
                        const dy = (scaleLine.y2 - scaleLine.y1) / 100 * natural.h
                        const pixelDist = Math.sqrt(dx * dx + dy * dy)
                        const scaleValue = `${pixelDist.toFixed(1)}px=${realDistance}m`
                        const field = scaleCampus === 'junior' ? 'juniorScale' : 'seniorScale'
                        const res = await fetch('/api/system/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'same-origin',
                          body: JSON.stringify({ [field]: scaleValue }),
                        })
                        if (!res.ok) throw new Error('保存失败')
                        setSavedScales(s => ({ ...s, [scaleCampus]: scaleValue }))
                        setScaleMsg('保存成功')
                        setTimeout(() => setScaleMsg(''), 2000)
                      } catch { setScaleMsg('保存失败') }
                      finally { setScaleSaving(false) }
                    }}
                    disabled={scaleSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg,#06B6D4,#0891B2)', opacity: scaleSaving ? 0.6 : 1 }}
                  >
                    {scaleSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    保存比例尺
                  </motion.button>
                  <button
                    onClick={() => { setScaleLine(null); setScalePoint1(null); setScaleResult(''); setRealDistance('') }}
                    className="px-4 py-2 rounded-xl text-white/50 text-sm"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    重置
                  </button>
                  {scaleMsg && <span className={`text-xs ${scaleMsg === '保存成功' ? 'text-emerald-400' : 'text-red-400'}`}>{scaleMsg}</span>}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AdminShell>
  )
}
