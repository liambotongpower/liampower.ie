'use client'

import { useState } from 'react'
import { processJobPostingAction } from './actions'

export default function UniqueResumePage() {
  const [jobText, setJobText] = useState('')
  const [embellishment, setEmbellishment] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<
    null | { ok: boolean; message: string; pdfAvailable?: boolean; texAvailable?: boolean; stdout?: string; stderr?: string }
  >(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('jobText', jobText)
      fd.set('embellishment', String(embellishment))
      const res = await processJobPostingAction(fd)
      setResult(res)
      if (res.stdout) console.log('stdout:', res.stdout)
      if (res.stderr) console.warn('stderr:', res.stderr)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Unique Resume Generator</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Paste the job posting text below. This will overwrite <code>job_posting.txt</code> and run <code>main.py</code> to
        update <code>Output_CV.tex</code> from <code>Input_CV.tex</code>.
      </p>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="embellishment" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Embellishment level (0-10)
          </label>
          <input
            id="embellishment"
            type="number"
            min={0}
            max={10}
            value={embellishment}
            onChange={(e) => setEmbellishment(Number(e.target.value))}
            style={{ width: 120, padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="jobText" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Job posting text
          </label>
          <textarea
            id="jobText"
            required
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={14}
            style={{ width: '100%', padding: 12, fontFamily: 'monospace' }}
            placeholder="Paste job description here..."
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 16px',
            background: '#111',
            color: '#fff',
            border: 0,
            borderRadius: 6,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Processing…' : 'Save & Generate'}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, color: result.ok ? 'green' : 'crimson' }}>{result.message}</div>
          {/* Download links */}
          {result.ok && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {result.pdfAvailable && (
                <a
                  href="/api/unique-resume?file=CV_Liam_Power.pdf"
                  download
                  style={{
                    padding: '8px 12px',
                    background: '#0a7',
                    color: '#fff',
                    borderRadius: 6,
                    textDecoration: 'none',
                  }}
                >
                  Download CV_Liam_Power.pdf
                </a>
              )}
              {result.texAvailable && (
                <a
                  href="/api/unique-resume?file=Output_CV.tex"
                  download
                  style={{
                    padding: '8px 12px',
                    background: '#555',
                    color: '#fff',
                    borderRadius: 6,
                    textDecoration: 'none',
                  }}
                >
                  Download Output_CV.tex
                </a>
              )}
              <span style={{ color: '#666' }}>Debug logs in console.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


