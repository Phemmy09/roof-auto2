'use client'

import { useEffect, useState } from 'react'
import { IFormula } from '@/types'
import { RefreshCw, Plus, Trash2 } from 'lucide-react'

const TEST_MEASUREMENTS = { squares: 18.33, pitch: 4, ridges: 48.1, hips: 4.6, valleys: 0, rakes: 75.6, eaves: 104.3, pipe_boots: 3, vents: 4 }

export default function SettingsPage() {
  const [formulas, setFormulas] = useState<IFormula[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const load = () =>
    fetch('/api/formulas').then((r) => r.json()).then((d) => setFormulas(Array.isArray(d) ? d : [])).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  async function handleSeed() {
    setSeeding(true)
    await fetch('/api/formulas/seed', { method: 'POST' })
    await load()
    setSeeding(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/formulas/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handlePreview(expr: string) {
    const res = await fetch('/api/formulas/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formula_expr: expr, measurements: TEST_MEASUREMENTS }),
    })
    const data = await res.json()
    alert(`Result: ${data.result}${data.error ? `\nError: ${data.error}` : ''}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Formula Engine</h1>
          <p className="text-sm text-gray-500">Configure how measurements are converted to material quantities.</p>
        </div>
        <button onClick={handleSeed} disabled={seeding} className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={14} /> {seeding ? 'Seeding...' : 'Reset to Defaults'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 mb-6">
        <strong>Test measurements:</strong> {Object.entries(TEST_MEASUREMENTS).map(([k, v]) => `${k}: ${v}`).join(', ')}
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-8">Loading formulas...</p>
      ) : formulas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No formulas yet</p>
          <button onClick={handleSeed} className="bg-brand text-white px-4 py-2 rounded-lg">Seed Default Formulas</button>
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Item', 'Formula', 'Unit', 'Category', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formulas.map((f) => (
                <tr key={f._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{f.name}</td>
                  <td className="px-4 py-3 text-gray-600">{f.itemName}</td>
                  <td className="px-4 py-3 font-mono text-xs bg-gray-50">{f.formulaExpr}</td>
                  <td className="px-4 py-3 text-gray-500">{f.unit}</td>
                  <td className="px-4 py-3 text-gray-500">{f.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handlePreview(f.formulaExpr)} className="text-xs text-brand hover:underline">Preview</button>
                      <button onClick={() => handleDelete(f._id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
