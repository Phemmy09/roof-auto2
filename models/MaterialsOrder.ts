import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMaterialsOrderDoc extends Document {
  jobId: mongoose.Types.ObjectId
  items: Array<{
    item: string; color: string; size: string
    qty: number; unit: string; category: string
  }>
  updatedAt: Date
}

const MaterialsOrderSchema = new Schema<IMaterialsOrderDoc>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, unique: true },
    items: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
)

const MaterialsOrder: Model<IMaterialsOrderDoc> =
  mongoose.models.MaterialsOrder ||
  mongoose.model<IMaterialsOrderDoc>('MaterialsOrder', MaterialsOrderSchema)
export default MaterialsOrder
