'use client'

import { useState } from 'react'
import { processJobPostingAction } from './actions'

export default function UniqueResumePage() {
  const [jobText, setJobText] = useState('')
  const [embellishment, setEmbellishment] = useState(5)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<null | { ok: boolean; message: string; stdout?: string; stderr?: string }>(null)

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
          {result.stdout && (
            <details open>
              <summary style={{ cursor: 'pointer', marginTop: 8, fontWeight: 600 }}>📄 stdout</summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                backgroundColor: '#f5f5f5', 
                padding: '12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                maxHeight: '400px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.4',
                fontFamily: 'monospace'
              }}>{result.stdout}</pre>
            </details>
          )}
          {result.stderr && (
            <details>
              <summary style={{ cursor: 'pointer', marginTop: 8, fontWeight: 600 }}>⚠️ stderr</summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                color: 'crimson',
                backgroundColor: '#ffeaea', 
                padding: '12px', 
                borderRadius: '6px', 
                border: '1px solid #ffcccc',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.4',
                fontFamily: 'monospace'
              }}>{result.stderr}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}


