import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IDocumentDoc extends Document {
  jobId: mongoose.Types.ObjectId
  fileName: string
  docType: string
  mimeType: string
  blobUrl: string        // Vercel Blob URL (replaces fileData buffer)
  extractedData: Record<string, unknown>
  processed: boolean
  createdAt: Date
}

const DocumentSchema = new Schema<IDocumentDoc>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    fileName: { type: String, required: true },
    docType: { type: String, required: true },
    mimeType: { type: String, default: 'application/pdf' },
    blobUrl: { type: String, required: true },
    extractedData: { type: Schema.Types.Mixed, default: {} },
    processed: { type: Boolean, default: false },
  },
  { timestamps: true }
)

const JobDocument: Model<IDocumentDoc> =
  mongoose.models.Document || mongoose.model<IDocumentDoc>('Document', DocumentSchema)
export default JobDocument
