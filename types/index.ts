export type JobStatus = 'pending' | 'processing' | 'review' | 'complete'

export type DocType = 'eagle_view' | 'contract' | 'insurance' | 'city_code' | 'photos'

export interface IJob {
  _id: string
  name: string
  customerName: string
  address: string
  notes: string
  status: JobStatus
  extractedData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface IDocument {
  _id: string
  jobId: string
  fileName: string
  docType: DocType
  mimeType: string
  extractedData: Record<string, unknown>
  processed: boolean
  createdAt: string
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
  _id: string
  jobId: string
  items: IMaterialItem[]
  updatedAt: string
}

export interface ICrewOrder {
  _id: string
  jobId: string
  data: Record<string, unknown>
  updatedAt: string
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
