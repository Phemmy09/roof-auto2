import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Structured extraction prompt for document PDFs (eagle_view, insurance, contract, etc.)
const DOC_PROMPT = (docType: string, fileName: string) =>
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

// Vision analysis prompt for roof images and photo documents
const IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are an expert roofing analyst. Analyze the provided roof images and documents.
Extract all measurements, identify damage types and severity, read all handwritten
annotations, note materials used, and provide a structured assessment report.
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
  "damage_types": array,
  "damage_severity": string,
  "materials_noted": array,
  "handwritten_notes": string,
  "special_notes": string,
  "insurance_company": string,
  "claim_number": string,
  "approved_amount": number,
  "deductible": number,
  "line_items": array
}
Return ONLY valid JSON, no explanation.`

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
      content: `${DOC_PROMPT(docType, fileName)}\n\nDocument text:\n${text}`,
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
        { type: 'text', text: DOC_PROMPT(docType, fileName) },
      ],
    }],
  })
  return parseJson(res.content[0].type === 'text' ? res.content[0].text : '{}')
}

// Extract data from a PDF document (text → base64 → chunked fallback)
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

  // Step 3: large image PDF — split into 8-page chunks
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

// Analyze image files using Claude vision — batches max 5 images per API call
// Used for photos doc type (JPEG, PNG, WebP, GIF uploads)
export async function analyzeImages(imageUrls: string[]): Promise<Record<string, unknown>> {
  const BATCH_SIZE = 5
  let combined: Record<string, unknown> = {}

  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE)
    console.log(`[analyzeImages] batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} images`)

    const imageContents = await Promise.all(
      batch.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`)
        const buffer = Buffer.from(await res.arrayBuffer())
        const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        const mediaType = validTypes.includes(contentType) ? contentType : 'image/jpeg'
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: buffer.toString('base64'),
          },
        }
      })
    )

    const res = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: IMAGE_ANALYSIS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          { type: 'text', text: 'Analyze these roof images and extract all data.' },
        ],
      }],
    })

    const result = parseJson(res.content[0].type === 'text' ? res.content[0].text : '{}')
    combined = mergeTwo(combined, result)
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
