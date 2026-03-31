import Link from 'next/link'
import { Home, Plus, Settings } from 'lucide-react'

export default function Navbar() {
  return (
    <nav className="bg-brand text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/jobs" className="font-bold text-lg">Roof Auto</Link>
        <div className="flex items-center gap-1">
          <Link href="/jobs" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-dark text-sm"><Home size={14} /> Jobs</Link>
          <Link href="/jobs/new" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-dark text-sm"><Plus size={14} /> New Job</Link>
          <Link href="/settings" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-brand-dark text-sm"><Settings size={14} /> Formula Engine</Link>
        </div>
      </div>
      <span className="text-sm opacity-75">Reliable Exteriors Group</span>
    </nav>
  )
}
