'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IJob } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import { Plus, Search } from 'lucide-react'

export default function JobsPage() {
  const [jobs, setJobs] = useState<IJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = jobs.filter(
    (j) =>
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      j.address?.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    pending: jobs.filter((j) => j.status === 'pending').length,
    processing: jobs.filter((j) => j.status === 'processing').length,
    review: jobs.filter((j) => j.status === 'review').length,
    complete: jobs.filter((j) => j.status === 'complete').length,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500">{jobs.length} total jobs</p>
        </div>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark"
        >
          <Plus size={16} /> New Job
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="bg-white rounded-xl border p-4">
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm text-gray-500 capitalize">{status}</p>
          </div>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="Search jobs by name, address, customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-12">Loading jobs...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No jobs yet</p>
          <Link href="/jobs/new" className="bg-brand text-white px-4 py-2 rounded-lg">
            Create your first job
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <Link
              key={job._id}
              href={`/jobs/${job._id}`}
              className="block bg-white border rounded-xl p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{job.name}</p>
                  <p className="text-sm text-gray-500">{job.customerName} · {job.address}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
