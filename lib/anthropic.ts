import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = (docType: string, fileName: string) =>
  `You are a roofing estimator AI. Extract all relevant data from this ${docType} document.
Return a JSON object with these fields (use null if not found):
{
  "squares": number,
  "pitch": number,
  "ridges": number,
  "hips": number,
  "valleys": number,
  "rakes": number,
  "eaves": number,
  "pipe_boots": number,
  "vents": number,
  "customer_name": string,
  "address": string,
  "insurance_company": string,
  "claim_number": string,
  "approved_amount": number,
  "deductible": number,
  "line_items": array,
  "special_notes": string
}
Return ONLY valid JSON, no explanation. File: ${fileName}`

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return {}
  }
}

function mergeTwo(a: Record<string, unknown>, b: Record<string, unknown>) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (v !== null && v !== undefined && out[k] === undefined) out[k] = v
  }
  return out
}

// Send PDF bytes directly to Claude as a base64 document
async function extractFromPdfBytes(
  pdfBytes: Buffer,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  const base64 = pdfBytes.toString('base64')
  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: PROMPT(docType, fileName) },
      ],
    }],
  })
  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  return parseJson(raw)
}

// Split large PDFs into chunks and process each
async function extractFromLargePdf(
  pdfBytes: Buffer,
  fileName: string,
  docType: string,
  chunkSize = 8
): Promise<Record<string, unknown>> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const totalPages = srcDoc.getPageCount()
  let combined: Record<string, unknown> = {}

  console.log(`[extract] ${fileName}: splitting ${totalPages} pages into chunks of ${chunkSize}`)

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages)
    const chunkDoc = await PDFDocument.create()
    const indices = Array.from({ length: end - start }, (_, i) => start + i)
    const pages = await chunkDoc.copyPages(srcDoc, indices)
    pages.forEach(p => chunkDoc.addPage(p))
    const chunkBytes = Buffer.from(await chunkDoc.save())
    const chunkName = `${fileName} (pages ${start + 1}-${end} of ${totalPages})`

    console.log(`[extract] processing chunk: pages ${start + 1}-${end}`)
    const result = await extractFromPdfBytes(chunkBytes, chunkName, docType)
    combined = mergeTwo(combined, result)

    // Stop early if all key measurements found
    const keys = ['squares', 'pitch', 'ridges', 'hips', 'valleys', 'rakes', 'eaves']
    if (keys.every(k => combined[k] !== null && combined[k] !== undefined)) {
      console.log(`[extract] all measurements found, stopping early at page ${end}`)
      break
    }
  }

  return combined
}

// Main entry — handles any PDF size
export async function extractDocument(
  blobUrl: string,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  console.log(`[extract] downloading: ${fileName}`)
  const res = await fetch(blobUrl)
  if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`)

  const pdfBytes = Buffer.from(await res.arrayBuffer())
  const sizeMb = pdfBytes.byteLength / 1024 / 1024
  console.log(`[extract] ${fileName}: ${sizeMb.toFixed(1)} MB`)

  if (sizeMb <= 20) {
    // Send whole PDF directly to Claude
    console.log(`[extract] ${fileName}: sending to Claude directly`)
    return await extractFromPdfBytes(pdfBytes, fileName, docType)
  }

  // Large file — split into chunks
  return await extractFromLargePdf(pdfBytes, fileName, docType)
}

// Merge results from all documents (eagle_view takes priority)
export function mergeExtractedData(
  docs: Array<{ docType: string; extractedData: Record<string, unknown> }>
) {
  const priority = ['eagle_view', 'insurance', 'contract', 'city_code', 'photos']
  const sorted = [...docs].sort(
    (a, b) => priority.indexOf(a.docType) - priority.indexOf(b.docType)
  )
  let merged: Record<string, unknown> = {}
  for (const doc of sorted) merged = mergeTwo(merged, doc.extractedData)
  return merged
}
