'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { IJob, IDocument, IMaterialsOrder, ICrewOrder } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Upload, Zap, Trash2, ArrowLeft, CheckCircle, FileText } from 'lucide-react'

const DOC_SLOTS = [
  { type: 'eagle_view',  label: 'Eagle View Report',     desc: 'Roof measurement report from Eagle View',      required: true },
  { type: 'insurance',   label: 'Insurance / Scope',      desc: 'Insurance claim or scope of loss document',    required: false },
  { type: 'contract',    label: 'Signed Contract',        desc: 'Customer-signed contract',                     required: false },
  { type: 'city_code',   label: 'City Code / Permit',     desc: 'Local building code or permit requirements',   required: false },
  { type: 'photos',      label: 'Job Site Photos',        desc: 'Photos of the roof or damage (multiple OK)',   required: false },
]

const STAGE_LABELS: Record<string, string> = {
  idle:        'Ready',
  downloading: 'Downloading files...',
  extracting:  'Reading documents...',
  analyzing:   'AI analyzing images...',
  calculating: 'Generating materials list...',
  done:        'Complete',
  failed:      'Processing failed',
}

type JobData = IJob & { documents: IDocument[]; materialsOrder: IMaterialsOrder | null; crewOrder: ICrewOrder | null }

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [compressingType, setCompressingType] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [processResult, setProcessResult] = useState<Record<string, unknown> | null>(null)
  const [processError, setProcessError] = useState('')
  const [processingStage, setProcessingStage] = useState<string>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = () =>
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then(setJob)
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [id])

  // Poll processing stage while processing is active
  useEffect(() => {
    if (processing) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${id}/status`)
          if (res.ok) {
            const data = await res.json()
            setProcessingStage(data.processingStage || 'idle')
          }
        } catch { /* ignore poll errors */ }
      }, 2000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [processing, id])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadProgress((p) => ({ ...p, [docType]: 0 }))

    for (const file of Array.from(files)) {
      let fileToUpload = file

      // Compress images before upload (skip PDFs and non-image files)
      if (file.type.startsWith('image/')) {
        setCompressingType(docType)
        try {
          const imageCompression = (await import('browser-image-compression')).default
          fileToUpload = await imageCompression(file, {
            maxSizeMB: 4,
            maxWidthOrHeight: 2048,
            useWebWorker: true,
            initialQuality: 0.85,
            onProgress: (pct) => {
              setUploadProgress((p) => ({ ...p, [docType]: Math.round(pct * 0.4) }))
            },
          })
        } catch (err) {
          console.warn('[compress] failed, uploading original:', err)
          fileToUpload = file
        }
        setCompressingType(null)
      }

      setUploadingType(docType)

      const blob = await upload(
        `jobs/${id}/${docType}_${Date.now()}_${file.name}`,
        fileToUpload,
        {
          access: 'public',
          handleUploadUrl: '/api/blob-upload',
          onUploadProgress: ({ percentage }) => {
            const base = fileToUpload !== file ? 40 : 0
            setUploadProgress((p) => ({ ...p, [docType]: base + Math.round(percentage * (100 - base) / 100) }))
          },
        }
      )
      await fetch(`/api/jobs/${id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blobUrl: blob.url,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          docType,
        }),
      })
    }

    await load()
    setUploadingType(null)
    setUploadProgress((p) => ({ ...p, [docType]: 100 }))
    e.target.value = ''
  }

  async function handleProcess() {
    setProcessing(true)
    setElapsed(0)
    setProcessError('')
    setProcessResult(null)
    setProcessingStage('downloading')

    const timer = setInterval(() => setElapsed((s) => s + 1), 1000)

    try {
      const res = await fetch(`/api/jobs/${id}/process`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setProcessError(data.error || 'Processing failed')
        setProcessingStage('failed')
      } else if (data.documentsProcessed === 0) {
        const errs = data.errors?.map((e: {file: string; error: string}) => `${e.file}: ${e.error}`).join('\n') || 'Unknown error'
        setProcessError(`No documents were processed.\n${errs}`)
        setProcessingStage('failed')
      } else {
        setProcessResult(data)
        setProcessingStage('done')
      }
      await load()
    } finally {
      clearInterval(timer)
      setProcessing(false)
    }
  }

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  async function handleDeleteDoc(docId: string) {
    await fetch(`/api/jobs/${id}/documents/${docId}`, { method: 'DELETE' })
    await load()
  }

  if (loading) return <p className="text-gray-400 py-12 text-center">Loading...</p>
  if (!job) return <p className="text-gray-400 py-12 text-center">Job not found</p>

  const docsByType = (type: string) => job.documents.filter((d) => d.docType === type)
  const totalDocs = job.documents.length
  const stageLabel = STAGE_LABELS[processingStage] ?? 'Processing...'

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => router.push('/jobs')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft size={14} /> Back to Jobs
      </button>

      {/* Job Header */}
      <div className="bg-white border rounded-xl p-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.name}</h1>
          <p className="text-gray-500">{job.customerName} · {job.address}</p>
          {job.notes && <p className="text-sm text-gray-400 mt-1">{job.notes}</p>}
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Document Upload Slots */}
      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Documents</h2>
            <p className="text-xs text-gray-400 mt-0.5">{totalDocs} file{totalDocs !== 1 ? 's' : ''} uploaded — upload one PDF per slot below</p>
          </div>
          {totalDocs > 0 && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 min-w-[180px] justify-center"
            >
              <Zap size={14} />
              {processing ? `Processing... ${formatElapsed(elapsed)}` : 'Analyze All Documents'}
            </button>
          )}
        </div>

        {/* Processing status indicator */}
        {processing && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <svg className="animate-spin h-4 w-4 text-blue-600 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-700">{stageLabel}</p>
                <p className="text-xs text-blue-500 mt-0.5">Do not close this page. ({formatElapsed(elapsed)} elapsed)</p>
              </div>
            </div>
            {/* Stage progress track */}
            <div className="flex gap-1 mt-2">
              {['downloading', 'extracting', 'analyzing', 'calculating', 'done'].map((s) => {
                const stages = ['downloading', 'extracting', 'analyzing', 'calculating', 'done']
                const current = stages.indexOf(processingStage)
                const idx = stages.indexOf(s)
                const active = idx <= current
                return (
                  <div key={s} className={`h-1 flex-1 rounded-full ${active ? 'bg-blue-500' : 'bg-blue-100'}`} />
                )
              })}
            </div>
            <div className="flex justify-between text-xs text-blue-400 mt-1">
              <span>Download</span><span>Read</span><span>Analyze</span><span>Calculate</span><span>Done</span>
            </div>
          </div>
        )}

        {processError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="font-semibold mb-1">Processing failed</p>
            {processError.split('\n').map((line, i) => (
              <p key={i} className="text-xs text-red-500">{line}</p>
            ))}
          </div>
        )}
        {processResult && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            AI analysis complete — {String(processResult.documentsProcessed)} doc(s) processed, {String(processResult.materialsItems)} materials items generated.
            {Array.isArray(processResult.errors) && processResult.errors.length > 0 && (
              <div className="mt-2 text-red-600">
                {(processResult.errors as Array<{file: string; error: string}>).map((e, i) => (
                  <div key={i}>⚠ {e.file}: {e.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {DOC_SLOTS.map((slot) => {
            const docs = docsByType(slot.type)
            const isCompressing = compressingType === slot.type
            const isUploading = uploadingType === slot.type
            const isBusy = isCompressing || isUploading
            const hasFiles = docs.length > 0
            const isPhotos = slot.type === 'photos'
            const progress = uploadProgress[slot.type] ?? 0

            return (
              <div
                key={slot.type}
                className={`border rounded-xl p-4 ${hasFiles ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 shrink-0 ${hasFiles ? 'text-green-500' : 'text-gray-300'}`}>
                      {hasFiles ? <CheckCircle size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800">{slot.label}</p>
                        {slot.required && <span className="text-xs text-red-500 font-medium">Required</span>}
                      </div>
                      <p className="text-xs text-gray-400">{slot.desc}</p>

                      {docs.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {docs.map((doc) => (
                            <li key={doc._id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="truncate max-w-xs">{doc.fileName}</span>
                              {doc.processed && <span className="text-green-600 font-medium shrink-0">Processed</span>}
                              <button
                                onClick={() => handleDeleteDoc(doc._id)}
                                className="text-red-400 hover:text-red-600 shrink-0"
                              >
                                <Trash2 size={12} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <label className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition
                    ${isBusy ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200' :
                      hasFiles ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' :
                      'bg-brand text-white border-brand hover:bg-brand-dark'}`}>
                    <Upload size={12} />
                    {isCompressing ? 'Compressing...' : isUploading ? `Uploading ${progress}%` : hasFiles ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.PDF,image/*"
                      multiple={isPhotos}
                      onChange={(e) => handleUpload(e, slot.type)}
                      disabled={isBusy}
                    />
                  </label>
                </div>

                {/* Compression or upload progress bar */}
                {(isCompressing || isUploading) && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      {isCompressing ? (
                        <span className="text-yellow-600">Compressing image...</span>
                      ) : (
                        <>
                          <span className="text-blue-600">Uploading to cloud...</span>
                          <span className="text-blue-600">{progress}%</span>
                        </>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      {isCompressing ? (
                        <div className="bg-yellow-400 h-2 rounded-full animate-pulse w-1/3" />
                      ) : (
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Materials Order */}
      {job.materialsOrder && job.materialsOrder.items.length > 0 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Materials Order</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-2">Item</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Unit</th>
                <th className="pb-2">Color</th>
                <th className="pb-2">Size</th>
                <th className="pb-2">Category</th>
              </tr>
            </thead>
            <tbody>
              {job.materialsOrder.items.map((item, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-medium">{item.item}</td>
                  <td className="py-2 font-bold text-brand">{item.qty}</td>
                  <td className="py-2">{item.unit}</td>
                  <td className="py-2 text-gray-400">{item.color || '—'}</td>
                  <td className="py-2 text-gray-400">{item.size || '—'}</td>
                  <td className="py-2 text-gray-400">{item.category || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Crew Order */}
      {job.crewOrder && Object.keys(job.crewOrder.data).length > 0 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Crew Order</h2>
          <pre className="text-sm text-gray-700 bg-gray-50 rounded p-3 overflow-auto">
            {JSON.stringify(job.crewOrder.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
