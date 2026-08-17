'use client'
// src/components/map/FeedbackModal.tsx
// 意见反馈弹窗：单选类型 + 必填描述 + 选填手机号，提交后显示成功弹窗
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, CheckCircle2, MessageSquare } from 'lucide-react'

const TYPE_OPTIONS = ['功能意见', '界面意见', '新的需求', '其他'] as const
type FeedbackType = typeof TYPE_OPTIONS[number]

const GLASS = {
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(50px) saturate(200%)',
  WebkitBackdropFilter: 'blur(50px) saturate(200%)',
  border: '1px solid rgba(255,255,255,0.5)',
  boxShadow: '0 12px 40px rgba(95,82,110,0.18), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(255,255,255,0.4)',
}

const CUBIC_BEZIER = [0.25, 0.46, 0.45, 0.94] as const

type FeedbackModalProps = {
  open: boolean
  onClose: () => void
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType | null>(null)
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setType(null)
    setDescription('')
    setPhone('')
    setError(null)
    setSuccess(false)
  }

  const handleClose = () => {
    if (submitting) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!type) { setError('请选择反馈类型'); return }
    if (!description.trim()) { setError('请描述您遇到的问题'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description: description.trim(), phone: phone.trim() || null }),
      })
      if (!res.ok) throw new Error('提交失败，请稍后重试')
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: CUBIC_BEZIER }}
          className="fixed inset-0 z-[130] flex items-center justify-center"
          style={{ background: 'rgba(95, 82, 110, 0.4)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', padding: '20px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          onClick={e => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.3, ease: CUBIC_BEZIER }}
            style={{
              ...GLASS,
              borderRadius: 24,
              width: '100%',
              maxWidth: 380,
              maxHeight: '86vh',
              overflow: 'hidden',
            }}
          >
            {success ? (
              /* ── 提交成功 ── */
              <div className="flex flex-col items-center text-center px-6 py-10">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(52,199,89,0.12)' }}>
                  <CheckCircle2 size={28} className="text-green-500" />
                </div>
                <div className="font-seal text-ink font-semibold text-[17px] leading-snug mb-2">
                  南渝中学信息中心已收到您的反馈
                </div>
                <div className="text-ink/50 text-[13px] mb-7">
                  感谢您对南渝中学智慧校园建设的贡献
                </div>
                <button
                  onClick={handleClose}
                  className="w-full py-3 rounded-2xl text-ink text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 4px 16px rgba(179,148,191,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)' }}
                >
                  完成
                </button>
              </div>
            ) : (
              /* ── 反馈表单 ── */
              <div className="px-6 pt-5 pb-6 flex flex-col" style={{ maxHeight: '86vh' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} style={{ color: '#B394BF' }} />
                    <h2 className="font-seal text-ink font-semibold text-base">意见反馈</h2>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-ink/30 hover:text-ink/60 transition-colors" aria-label="关闭"
                    style={{ background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.35)' }}>
                    <X size={14} />
                  </button>
                </div>
                <p className="text-ink/45 text-xs mb-5">您的意见将帮助我们持续改进，欢迎提出宝贵建议。</p>

                {/* 第 1 题：单选 */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1 mb-2.5">
                    <span className="text-red-400 text-xs">*</span>
                    <span className="text-ink/80 text-[13px] font-medium">您的反馈类型</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setType(opt)}
                        className="px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
                        style={{
                          background: type === opt ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)',
                          backdropFilter: 'blur(30px)',
                          WebkitBackdropFilter: 'blur(30px)',
                          border: type === opt ? '1px solid rgba(179,148,191,0.6)' : '1px solid rgba(255,255,255,0.35)',
                          boxShadow: type === opt ? 'inset 0 1px 0 rgba(255,255,255,0.8)' : 'none',
                          color: type === opt ? '#5F526E' : 'rgba(95,82,110,0.65)',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 第 2 题：必填描述 */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1 mb-2.5">
                    <span className="text-red-400 text-xs">*</span>
                    <span className="text-ink/80 text-[13px] font-medium">请描述您遇到的问题</span>
                  </div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="请描述您是在哪里遇到的、怎样触发的、什么问题"
                    rows={4}
                    maxLength={500}
                    className="w-full px-3.5 py-3 rounded-2xl text-ink text-[13px] leading-relaxed resize-none outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.5)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      border: '1px solid rgba(255,255,255,0.4)',
                      color: '#5F526E',
                    }}
                  />
                  <div className="text-right text-ink/30 text-[10px] mt-1">{description.length}/500</div>
                </div>

                {/* 第 3 题：选填手机号 */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1 mb-2.5">
                    <span className="text-ink/30 text-xs">选填</span>
                    <span className="text-ink/80 text-[13px] font-medium">请填写您的手机号（选填）</span>
                  </div>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                    placeholder="方便我们与您联系"
                    inputMode="numeric"
                    className="w-full px-3.5 py-2.5 rounded-2xl text-ink text-[13px] outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.5)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      border: '1px solid rgba(255,255,255,0.4)',
                      color: '#5F526E',
                    }}
                  />
                </div>

                {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl text-ink text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(50px) saturate(200%)', WebkitBackdropFilter: 'blur(50px) saturate(200%)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 4px 16px rgba(179,148,191,0.2), inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -1px 0 rgba(255,255,255,0.35)', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  {submitting ? '提交中…' : '提交反馈'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
