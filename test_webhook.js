/**
 * Quick test: sends a sample payload to the n8n webhook
 * and prints whatever n8n sends back.
 *
 * Run with:  node test_webhook.js
 */

const WEBHOOK = 'https://n8n.izzytechub.com/webhook/84f4774b-e5a5-4e75-93d8-812b628c4e46'

const payload = {
  jobId: 'test-job-001',
  jobName: 'Test Job - Webhook Check',
  customerName: 'John Doe',
  address: '123 Main St, Kansas City, MO',
  documents: [
    {
      docType: 'eagle_view',
      fileName: 'EagleView_Test.pdf',
      mimeType: 'application/pdf',
      blobUrl: 'https://example.com/sample.pdf', // replace with a real blob URL to test file download
    },
  ],
}

console.log('Sending payload to n8n webhook...')
console.log('URL :', WEBHOOK)
console.log('Body:', JSON.stringify(payload, null, 2))
console.log('---')

const start = Date.now()

fetch(WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
  .then(async (res) => {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`Response received in ${elapsed}s`)
    console.log('Status :', res.status, res.statusText)

    const text = await res.text()
    try {
      const json = JSON.parse(text)
      console.log('Body (JSON):', JSON.stringify(json, null, 2))
    } catch {
      console.log('Body (text):', text)
    }
  })
  .catch((err) => {
    console.error('Request failed:', err.message)
  })
