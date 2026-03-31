import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IJobDoc extends Document {
  name: string
  customerName: string
  address: string
  notes: string
  status: 'pending' | 'processing' | 'review' | 'complete'
  extractedData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const JobSchema = new Schema<IJobDoc>(
  {
    name: { type: String, required: true },
    customerName: { type: String, default: '' },
    address: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'processing', 'review', 'complete'], default: 'pending' },
    extractedData: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

// Auto-delete jobs 10 minutes after creation
JobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 })

const Job: Model<IJobDoc> = mongoose.models.Job || mongoose.model<IJobDoc>('Job', JobSchema)
export default Job
