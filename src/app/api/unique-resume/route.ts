import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const UNIQUE_RESUME_DIR = '/Users/liambpower/Developer/liampower.ie/src/app/unique-resume'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')
  if (!file) {
    return new Response('Missing ?file= parameter', { status: 400 })
  }

  const safe = path.basename(file)
  const fullPath = path.join(UNIQUE_RESUME_DIR, safe)
  try {
    const data = await fs.readFile(fullPath)
    const isPdf = safe.toLowerCase().endsWith('.pdf')
    const isTex = safe.toLowerCase().endsWith('.tex')
    const contentType = isPdf
      ? 'application/pdf'
      : isTex
      ? 'application/x-tex'
      : 'application/octet-stream'
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safe}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return new Response('File not found', { status: 404 })
  }
}


