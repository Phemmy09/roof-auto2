import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICrewOrderDoc extends Document {
  jobId: mongoose.Types.ObjectId
  data: Record<string, unknown>
  updatedAt: Date
}

const CrewOrderSchema = new Schema<ICrewOrderDoc>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, unique: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

const CrewOrder: Model<ICrewOrderDoc> =
  mongoose.models.CrewOrder || mongoose.model<ICrewOrderDoc>('CrewOrder', CrewOrderSchema)
export default CrewOrder
