interface Props {
  status: string
}

const COLOR_MAP: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-600',
  uploading:  'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  analyzing:  'bg-purple-100 text-purple-700',
  review:     'bg-orange-100 text-orange-700',
  complete:   'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
}

export default function StatusBadge({ status }: Props) {
  const colors = COLOR_MAP[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${colors}`}>
      {status}
    </span>
  )
}
