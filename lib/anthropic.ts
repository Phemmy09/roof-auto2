import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function extractDocument(
  blobUrl: string,
  fileName: string,
  docType: string
): Promise<Record<string, unknown>> {
  const isPdf = fileName.toLowerCase().endsWith('.pdf')
  const mediaType = isPdf ? 'application/pdf' : 'image/jpeg'

  const prompt = `You are a roofing estimator AI. Extract all relevant data from this ${docType} document.
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
Return ONLY valid JSON, no explanation.`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            type: 'document',
            source: { type: 'url', url: blobUrl, media_type: mediaType },
          } as any,
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {}
  }
}

export function mergeExtractedData(docs: Array<{ docType: string; extractedData: Record<string, unknown> }>) {
  const merged: Record<string, unknown> = {}
  const priority = ['eagle_view', 'insurance', 'contract', 'city_code', 'photos']
  const sorted = [...docs].sort(
    (a, b) => priority.indexOf(a.docType) - priority.indexOf(b.docType)
  )
  for (const doc of sorted) {
    for (const [k, v] of Object.entries(doc.extractedData)) {
      if (v !== null && v !== undefined && merged[k] === undefined) {
        merged[k] = v
      }
    }
  }
  return merged
}
