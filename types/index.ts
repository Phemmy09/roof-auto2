export type JobStatus = 'pending' | 'uploading' | 'processing' | 'analyzing' | 'complete' | 'failed' | 'review'

export type DocType = 'eagle_view' | 'contract' | 'insurance' | 'city_code' | 'photos'

export interface IJob {
  id: string
  name: string
  customer_name: string
  email: string
  address: string
  notes: string
  status: JobStatus
  processing_stage: string
  extracted_data: Record<string, unknown>
  result: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
}

export interface IDocument {
  id: string
  job_id: string
  file_name: string
  doc_type: DocType
  mime_type: string
  file_url: string
  file_type: string
  extracted_data: Record<string, unknown>
  processed: boolean
  created_at: string
}

export interface IMaterialItem {
  item: string
  color: string
  size: string
  qty: number
  unit: string
  category: string
}

export interface IMaterialsOrder {
  id: string
  job_id: string
  items: IMaterialItem[]
  updated_at: string
}

export interface ICrewOrder {
  id: string
  job_id: string
  data: Record<string, unknown>
  updated_at: string
}

export interface IFormula {
  _id: string
  name: string
  itemName: string
  formulaExpr: string
  unit: string
  defaultColor: string
  defaultSize: string
  category: string
  active: boolean
  sortOrder: number
  createdAt: string
}

export interface Measurements {
  squares: number
  pitch: number
  ridges: number
  hips: number
  valleys: number
  rakes: number
  eaves: number
  pipe_boots: number
  vents: number
  [key: string]: number
}
