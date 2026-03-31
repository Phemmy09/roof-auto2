import { JobStatus } from '@/types'

const styles: Record<JobStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-yellow-100 text-yellow-700',
  review: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
}

export default function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${styles[status]}`}>
      {status}
    </span>
  )
}
