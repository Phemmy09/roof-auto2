import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { connectDB } from '@/lib/mongodb'
import JobDocument from '@/models/Document'
import Job from '@/models/Job'
import MaterialsOrder from '@/models/MaterialsOrder'
import CrewOrder from '@/models/CrewOrder'

// Vercel Cron calls this with a secret header — block everything else
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  // Find all documents whose parent job no longer exists (orphaned after TTL)
  const allDocs = await JobDocument.find({}).select('jobId blobUrl').lean()
  const jobIds = Array.from(new Set(allDocs.map((d) => String(d.jobId))))

  // Check which jobs still exist
  const existingJobs = await Job.find({ _id: { $in: jobIds } }).select('_id').lean()
  const existingIds = new Set(existingJobs.map((j) => String(j._id)))

  // Docs whose job has been TTL-deleted
  const orphaned = allDocs.filter((d) => !existingIds.has(String(d.jobId)))

  let blobsDeleted = 0
  let docsDeleted = 0

  for (const doc of orphaned) {
    if (doc.blobUrl) {
      try {
        await del(doc.blobUrl)
        blobsDeleted++
      } catch { /* blob may already be gone */ }
    }
    await JobDocument.findByIdAndDelete(doc._id)
    docsDeleted++
  }

  // Also clean up orphaned materials/crew orders
  const allOrders = await MaterialsOrder.find({}).select('jobId').lean()
  for (const order of allOrders) {
    if (!existingIds.has(String(order.jobId))) {
      await MaterialsOrder.findByIdAndDelete(order._id)
      await CrewOrder.deleteOne({ jobId: order.jobId })
    }
  }

  console.log(`[cron/cleanup] ${docsDeleted} orphaned docs removed, ${blobsDeleted} blobs deleted`)

  return NextResponse.json({
    orphanedDocs: docsDeleted,
    blobsDeleted,
    checkedAt: new Date().toISOString(),
  })
}
