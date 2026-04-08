import Anthropic from '@anthropic-ai/sdk'
import { PDFDocument } from 'pdf-lib'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = (docType: string, fileName: string) => `
You are a roofing estimator AI. Extract all relevant data from this ${docType} document.
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
Return ONLY valid JSON, no explanation. File: ${fileName}`.trim()

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return {}
  }
}

// Merge two result objects — first value wins
function merge(a: Record<string, unknown>, b: Record<string, unknown>) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (v !== null && v !== undefined && out[k] === undefined) out[k] = v
  }
  return out
}

// ── Send plain text to Claude ────────────────────────────────────────────────
async function extractFromText(
  text: string,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `${PROMPT(docType, fileName)}\n\nDocument text:\n${text}`,
    }],
  })
  return parseJson(res.content[0].type === 'text' ? res.content[0].text : '{}')
}

// ── Send PDF bytes as base64 document to Claude vision ───────────────────────
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
  return parseJson(res.content[0].type === 'text' ? res.content[0].text : '{}')
}

// ── Split large PDF into chunks and process each ─────────────────────────────
async function extractFromLargePdf(
  pdfBytes: Buffer,
  fileName: string,
  docType: string,
  chunkSize = 10          // pages per chunk
): Promise<Record<string, unknown>> {
  const srcDoc = await PDFDocument.load(pdfBytes)
  const totalPages = srcDoc.getPageCount()
  let combined: Record<string, unknown> = {}

  for (let start = 0; start < totalPages; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPages)
    const chunkDoc = await PDFDocument.create()
    const pages = await chunkDoc.copyPages(srcDoc, Array.from({ length: end - start }, (_, i) => start + i))
    pages.forEach(p => chunkDoc.addPage(p))
    const chunkBytes = Buffer.from(await chunkDoc.save())

    const chunkName = `${fileName} (pages ${start + 1}-${end})`
    const result = await extractFromPdfBytes(chunkBytes, chunkName, docType)
    combined = merge(combined, result)

    // Stop early if we already have all key measurements
    const keys = ['squares', 'pitch', 'ridges', 'hips', 'valleys', 'rakes', 'eaves']
    if (keys.every(k => combined[k] !== null && combined[k] !== undefined)) break
  }

  return combined
}

// ── Main export: smart extraction regardless of PDF type or size ─────────────
export async function extractDocument(
  blobUrl: string,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  // Download the file from Vercel Blob
  const res = await fetch(blobUrl)
  const pdfBytes = Buffer.from(await res.arrayBuffer())
  const sizeMb = pdfBytes.byteLength / 1024 / 1024

  // Step 1: try text extraction with pdfjs (server-safe dynamic import)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) })
    const pdf = await task.promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text += content.items.map((item: any) => item.str).join(' ') + '\n'
    }
    text = text.trim()

    // If we got meaningful text, use it (fast + cheap)
    if (text.length > 300) {
      console.log(`[extract] ${fileName}: text (${(text.length / 1024).toFixed(1)} KB)`)
      return await extractFromText(text, fileName, docType)
    }
  } catch {
    // pdfjs failed — fall through to vision
  }

  // Step 2: image-based PDF — send to Claude vision
  console.log(`[extract] ${fileName}: vision (${sizeMb.toFixed(1)} MB)`)

  if (sizeMb <= 20) {
    // Small enough to send whole
    return await extractFromPdfBytes(pdfBytes, fileName, docType)
  }

  // Step 3: large image PDF — split into chunks
  console.log(`[extract] ${fileName}: chunked vision (${sizeMb.toFixed(1)} MB)`)
  return await extractFromLargePdf(pdfBytes, fileName, docType)
}

// ── Merge results from multiple documents ────────────────────────────────────
export function mergeExtractedData(
  docs: Array<{ docType: string; extractedData: Record<string, unknown> }>
) {
  const priority = ['eagle_view', 'insurance', 'contract', 'city_code', 'photos']
  const sorted = [...docs].sort(
    (a, b) => priority.indexOf(a.docType) - priority.indexOf(b.docType)
  )
  let merged: Record<string, unknown> = {}
  for (const doc of sorted) merged = merge(merged, doc.extractedData)
  return merged
}
