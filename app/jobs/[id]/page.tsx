'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type JobData = IJob & { documents: IDocument[]; materialsOrder: IMaterialsOrder | null; crewOrder: ICrewOrder | null }

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [job, setJob] = useState<JobData | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [uploadingType, setUploadingType] = useState<string | null>(null)
  const [processResult, setProcessResult] = useState<Record<string, unknown> | null>(null)
  const [processError, setProcessError] = useState('')

  const load = () =>
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then(setJob)
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [id])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingType(docType)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      await fetch(`/api/jobs/${id}/documents`, { method: 'POST', body: fd })
    }
    await load()
    setUploadingType(null)
    e.target.value = ''
  }

  async function handleProcess() {
    setProcessing(true)
    setProcessError('')
    setProcessResult(null)
    const res = await fetch(`/api/jobs/${id}/process`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setProcessResult(data)
    } else {
      setProcessError(data.error || 'Processing failed')
    }
    await load()
    setProcessing(false)
  }

  async function handleDeleteDoc(docId: string) {
    await fetch(`/api/jobs/${id}/documents/${docId}`, { method: 'DELETE' })
    await load()
  }

  if (loading) return <p className="text-gray-400 py-12 text-center">Loading...</p>
  if (!job) return <p className="text-gray-400 py-12 text-center">Job not found</p>

  const docsByType = (type: string) => job.documents.filter((d) => d.docType === type)
  const totalDocs = job.documents.length

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
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              <Zap size={14} />
              {processing ? 'Processing with AI...' : 'Process All with AI'}
            </button>
          )}
        </div>

        {processError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{processError}</div>
        )}
        {processResult && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            AI processing complete — {String(processResult.documentsProcessed)} doc(s) processed, {String(processResult.materialsItems)} materials items generated.
          </div>
        )}

        <div className="space-y-3">
          {DOC_SLOTS.map((slot) => {
            const docs = docsByType(slot.type)
            const isUploading = uploadingType === slot.type
            const hasFiles = docs.length > 0
            const isPhotos = slot.type === 'photos'

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

                      {/* Uploaded files for this slot */}
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

                  {/* Upload button */}
                  <label className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition
                    ${isUploading ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200' :
                      hasFiles ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' :
                      'bg-brand text-white border-brand hover:bg-brand-dark'}`}>
                    <Upload size={12} />
                    {isUploading ? 'Uploading...' : hasFiles ? 'Replace' : 'Upload PDF'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.PDF,image/*"
                      multiple={isPhotos}
                      onChange={(e) => handleUpload(e, slot.type)}
                      disabled={isUploading}
                    />
                  </label>
                </div>
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
