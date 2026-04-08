import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

// This endpoint issues a short-lived token so the browser can upload
// directly to Vercel Blob — no file data passes through the server.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
      ],
      maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB — no practical limit
    }),
    onUploadCompleted: async ({ blob }) => {
      console.log('[blob-upload] completed:', blob.url)
    },
  })

  return NextResponse.json(jsonResponse)
}
