import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = (docType: string, fileName: string) =>
  `You are a roofing estimator AI. Extract all relevant data from this ${docType} document text.
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

// Extract text from PDF buffer using pdfjs-dist (works in Node.js serverless)
async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  })
  const pdf = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text.trim()
}

// Send extracted text to Claude
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

// Send small PDF as base64 to Claude vision (fallback for image-based PDFs)
async function extractFromBase64(
  buffer: Buffer,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  const base64 = buffer.toString('base64')
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

export async function extractDocument(
  blobUrl: string,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  console.log(`[extract] downloading: ${fileName}`)
  const res = await fetch(blobUrl)
  if (!res.ok) throw new Error(`Failed to fetch blob (${res.status}): ${blobUrl}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const sizeMb = (buffer.byteLength / 1024 / 1024).toFixed(1)
  console.log(`[extract] ${fileName}: ${sizeMb} MB`)

  // Step 1: try text extraction
  try {
    const text = await extractTextFromBuffer(buffer)
    if (text.length > 200) {
      console.log(`[extract] ${fileName}: text extracted (${(text.length / 1024).toFixed(1)} KB) → sending to Claude`)
      return await extractFromText(text, fileName, docType)
    }
    console.log(`[extract] ${fileName}: text too short (${text.length} chars), trying vision`)
  } catch (e) {
    console.log(`[extract] ${fileName}: text extraction failed (${String(e).slice(0, 100)}), trying vision`)
  }

  // Step 2: image-based PDF — send as base64 (only if under 20 MB)
  if (buffer.byteLength <= 20 * 1024 * 1024) {
    console.log(`[extract] ${fileName}: sending as base64 vision`)
    return await extractFromBase64(buffer, fileName, docType)
  }

  // Step 3: large image PDF — split into chunks
  console.log(`[extract] ${fileName}: too large for vision, splitting into chunks`)
  const { PDFDocument } = await import('pdf-lib')
  const srcDoc = await PDFDocument.load(buffer)
  const totalPages = srcDoc.getPageCount()
  let combined: Record<string, unknown> = {}

  for (let start = 0; start < totalPages; start += 8) {
    const end = Math.min(start + 8, totalPages)
    const chunkDoc = await PDFDocument.create()
    const indices = Array.from({ length: end - start }, (_, i) => start + i)
    const pages = await chunkDoc.copyPages(srcDoc, indices)
    pages.forEach(p => chunkDoc.addPage(p))
    const chunkBytes = Buffer.from(await chunkDoc.save())
    const result = await extractFromBase64(chunkBytes, `${fileName} (pages ${start + 1}-${end})`, docType)
    combined = mergeTwo(combined, result)
    const keys = ['squares', 'pitch', 'ridges', 'hips', 'valleys', 'rakes', 'eaves']
    if (keys.every(k => combined[k] !== null && combined[k] !== undefined)) break
  }
  return combined
}

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
