/**
 * Local end-to-end test — extracts text from Bramlage PDFs,
 * sends each to Claude AI, then runs the formula engine.
 * No n8n. No Vercel Blob.
 *
 * Run with:  node test_webhook_real.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import Anthropic from '@anthropic-ai/sdk'

const __dir = dirname(fileURLToPath(import.meta.url))
const BRAMLAGE_DIR = join(__dir, '..', 'Bramlage')

// Load ANTHROPIC_API_KEY from .env.local
const envPath = join(__dir, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in .env.local')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FILES = [
  { file: 'EagleView_Bramlage_B.pdf',        docType: 'eagle_view' },
  { file: 'Roof_Scope_Bramlage_B.pdf',        docType: 'insurance'  },
  { file: 'Contract_Bramlage_B.pdf',          docType: 'contract'   },
  { file: 'City_County Codes_Bramlage_B.pdf', docType: 'city_code'  },
  { file: 'ALL_Photos_Bramlage_B.pdf',        docType: 'photos'     },
]

function logOk(msg)   { console.log('  ✅', msg) }
function logErr(msg)  { console.log('  ❌', msg) }
function logInfo(msg) { console.log('  ℹ ', msg) }

async function extractText(buffer) {
  const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
  const pdf = await task.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text.trim()
}

async function extractWithClaude(text, fileName, docType) {
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
  "special_notes": string
}
Return ONLY valid JSON, no explanation.

File: ${fileName}
Text:
${text}`

  const res = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = res.content[0].type === 'text' ? res.content[0].text : '{}'
  try {
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim())
  } catch {
    return {}
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════════')
  console.log('  Roof Auto — Local Claude Processing Test')
  console.log('══════════════════════════════════════════════\n')

  const results = []

  for (const { file, docType } of FILES) {
    const filePath = join(BRAMLAGE_DIR, file)
    if (!existsSync(filePath)) { logErr(`Not found: ${file}`); continue }

    const buffer = readFileSync(filePath)
    const originalMb = (buffer.byteLength / 1024 / 1024).toFixed(1)

    console.log(`\n── [${docType}] ${file} (${originalMb} MB)`)

    // Step 1: extract text
    process.stdout.write('  Extracting text...')
    const text = await extractText(buffer)
    const textKb = (Buffer.byteLength(text) / 1024).toFixed(1)
    process.stdout.write(` ${textKb} KB extracted\n`)

    if (!text || text.length < 10) {
      logInfo('No readable text found (image-based PDF), skipping Claude call')
      continue
    }

    // Step 2: send text to Claude
    process.stdout.write('  Sending to Claude...')
    try {
      const extracted = await extractWithClaude(text, file, docType)
      console.log(' done')
      logOk(`Extracted data:`)
      console.log(JSON.stringify(extracted, null, 4).split('\n').map(l => '     ' + l).join('\n'))
      results.push({ docType, extracted })
    } catch (err) {
      logErr(`Claude failed: ${err.message}`)
    }
  }

  // Merge results (eagle_view takes priority)
  if (results.length > 0) {
    console.log('\n══════════════════════════════════════════════')
    console.log('  MERGED MEASUREMENTS:')
    console.log('══════════════════════════════════════════════')
    const priority = ['eagle_view', 'insurance', 'contract', 'city_code', 'photos']
    const sorted = [...results].sort((a, b) => priority.indexOf(a.docType) - priority.indexOf(b.docType))
    const merged = {}
    for (const { extracted } of sorted) {
      for (const [k, v] of Object.entries(extracted)) {
        if (v !== null && v !== undefined && merged[k] === undefined) merged[k] = v
      }
    }
    console.log(JSON.stringify(merged, null, 2))

    const fields = ['squares','pitch','ridges','hips','valleys','rakes','eaves','pipe_boots','vents']
    console.log('\n  Key measurements:')
    for (const f of fields) {
      merged[f] != null ? logOk(`${f}: ${merged[f]}`) : logErr(`${f}: missing`)
    }
  }

  console.log('\nDone.\n')
}

run().catch(err => { console.error(err); process.exit(1) })
