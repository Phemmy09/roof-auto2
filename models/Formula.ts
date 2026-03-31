import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IFormulaDoc extends Document {
  name: string
  itemName: string
  formulaExpr: string
  unit: string
  defaultColor: string
  defaultSize: string
  category: string
  active: boolean
  sortOrder: number
  createdAt: Date
}

const FormulaSchema = new Schema<IFormulaDoc>(
  {
    name: { type: String, required: true },
    itemName: { type: String, required: true },
    formulaExpr: { type: String, required: true },
    unit: { type: String, required: true },
    defaultColor: { type: String, default: '' },
    defaultSize: { type: String, default: '' },
    category: { type: String, default: 'main' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
)

const Formula: Model<IFormulaDoc> =
  mongoose.models.Formula || mongoose.model<IFormulaDoc>('Formula', FormulaSchema)
export default Formula
