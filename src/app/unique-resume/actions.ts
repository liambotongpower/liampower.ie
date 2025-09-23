'use server'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const execFileAsync = promisify(execFile)

const UNIQUE_RESUME_DIR = '/Users/liambpower/Developer/liampower.ie/src/app/unique-resume'
const JOB_POSTING_PATH = path.join(UNIQUE_RESUME_DIR, 'job_posting.txt')

export type RunResult = {
  ok: boolean
  message: string
  stdout?: string
  stderr?: string
  pdfAvailable?: boolean
  texAvailable?: boolean
}

export async function processJobPostingAction(formData: FormData): Promise<RunResult> {
  type ExecFileErrorLike = Error & { stdout?: string; stderr?: string }
  try {
    const text = String(formData.get('jobText') || '')
    const embellishmentRaw = String(formData.get('embellishment') || '5')
    const embellishment = Math.max(0, Math.min(10, Number.parseInt(embellishmentRaw, 10) || 5))

    if (!text.trim()) {
      return { ok: false, message: 'Please paste the job posting text.' }
    }

    console.log('🔍 DEBUG: Writing job posting to file...')
    await writeFile(JOB_POSTING_PATH, text, { encoding: 'utf8' })
    console.log('✅ DEBUG: Job posting written successfully')

    // Check Python version and environment
    console.log('🔍 DEBUG: Checking Python environment...')
    try {
      const { stdout: pythonVersion } = await execFileAsync('python3', ['--version'], { cwd: UNIQUE_RESUME_DIR })
      console.log('🐍 DEBUG: Python version:', pythonVersion.trim())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.log('❌ DEBUG: Python check failed:', message)
      return { ok: false, message: 'Python3 not found. Please install Python 3.', stderr: message }
    }

    // Check if pip is available
    try {
      const { stdout: pipVersion } = await execFileAsync('python3', ['-m', 'pip', '--version'], { cwd: UNIQUE_RESUME_DIR })
      console.log('📦 DEBUG: Pip version:', pipVersion.trim())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.log('❌ DEBUG: Pip check failed:', message)
      return { ok: false, message: 'Pip not found. Please install pip.', stderr: message }
    }

    // Check if virtual environment exists, create if not
    console.log('🔍 DEBUG: Checking for virtual environment...')
    const venvPath = path.join(UNIQUE_RESUME_DIR, 'venv')
    const venvPython = path.join(venvPath, 'bin', 'python3')
    
    try {
      await execFileAsync('ls', [venvPython])
      console.log('✅ DEBUG: Virtual environment found')
    } catch {
      console.log('🔍 DEBUG: Creating virtual environment...')
      try {
        await execFileAsync('python3', ['-m', 'venv', 'venv'], { cwd: UNIQUE_RESUME_DIR })
        console.log('✅ DEBUG: Virtual environment created')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.log('❌ DEBUG: Failed to create virtual environment:', message)
        return { ok: false, message: 'Failed to create virtual environment', stderr: message }
      }
    }

    // Install dependencies in virtual environment
    console.log('🔍 DEBUG: Installing Python dependencies in virtual environment...')
    try {
      const { stdout: installStdout, stderr: installStderr } = await execFileAsync(
        venvPython, 
        ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', '-r', 'requirements.txt'], 
        { cwd: UNIQUE_RESUME_DIR, env: process.env }
      )
      console.log('📦 DEBUG: Install stdout:', installStdout)
      if (installStderr) console.log('📦 DEBUG: Install stderr:', installStderr)
      console.log('✅ DEBUG: Dependencies installed successfully')
    } catch (err: unknown) {
      const e = (err ?? {}) as Partial<ExecFileErrorLike>
      const message = e.message ?? String(err)
      const stdout = e.stdout
      const stderr = e.stderr
      console.log('⚠️ DEBUG: Dependency installation failed:', message)
      if (stdout) console.log('📦 DEBUG: Install stdout:', stdout)
      if (stderr) console.log('📦 DEBUG: Install stderr:', stderr)
      // Continue anyway - the script might still work
    }

    // Check if API key is available
    console.log('🔑 DEBUG: Checking for API key...')
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.log('❌ DEBUG: No API key found in environment')
      return { 
        ok: false, 
        message: 'No GOOGLE_GEMINI_API_KEY found in environment. Please set it in your .env file or environment variables.',
        stderr: 'Missing API key'
      }
    }
    console.log('✅ DEBUG: API key found (length:', apiKey.length, ')')

    // Test Python import before running main script
    console.log('🔍 DEBUG: Testing Python imports...')
    try {
      const { stdout: importTest } = await execFileAsync(
        venvPython,
        ['-c', 'import google.generativeai as genai; import dotenv; print("Imports successful")'],
        { cwd: UNIQUE_RESUME_DIR, env: process.env }
      )
      console.log('✅ DEBUG: Import test successful:', importTest.trim())
    } catch (err: unknown) {
      const e = (err ?? {}) as Partial<ExecFileErrorLike>
      const message = e.message ?? String(err)
      const stderr = e.stderr
      console.log('❌ DEBUG: Import test failed:', message)
      if (stderr) console.log('📦 DEBUG: Import stderr:', stderr)
      return { 
        ok: false, 
        message: 'Python imports failed. Check dependencies installation.',
        stdout: e.stdout,
        stderr: stderr || message
      }
    }

    // Run the main script
    console.log('🚀 DEBUG: Running main.py with embellishment level:', embellishment)
    try {
      const { stdout, stderr } = await execFileAsync(
        venvPython,
        ['main.py', 'job_posting.txt', '-e', String(embellishment)],
        { cwd: UNIQUE_RESUME_DIR, env: process.env }
      )
      console.log('✅ DEBUG: Script completed successfully')
      console.log('📄 DEBUG: Script stdout:', stdout)
      if (stderr) console.log('⚠️ DEBUG: Script stderr:', stderr)
      // Attempt to compile PDF from Output_CV.tex
      let pdfAvailable = false
      const compileCandidates = ['pdflatex', 'xelatex', 'lualatex']
      for (const bin of compileCandidates) {
        try {
          console.log('🔧 DEBUG: Trying LaTeX compiler:', bin)
          const { stdout: cOut, stderr: cErr } = await execFileAsync(
            bin,
            ['-interaction=nonstopmode', '-halt-on-error', '-jobname=CV_Liam_Power', 'Output_CV.tex'],
            { cwd: UNIQUE_RESUME_DIR, env: process.env }
          )
          console.log('🖨️ DEBUG: LaTeX compile stdout:', cOut)
          if (cErr) console.log('🖨️ DEBUG: LaTeX compile stderr:', cErr)
          pdfAvailable = true
          break
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          console.log('⚠️ DEBUG: LaTeX compile failed with', bin, message)
          continue
        }
      }

      return { 
        ok: true, 
        message: 'Processed successfully.', 
        stdout, 
        stderr,
        pdfAvailable,
        texAvailable: true
      }
    } catch (err: unknown) {
      const e = (err ?? {}) as Partial<ExecFileErrorLike>
      const message = e.message ?? String(err)
      const stdout = e.stdout
      const stderr = e.stderr
      console.log('❌ DEBUG: Script execution failed:', message)
      if (stdout) console.log('📄 DEBUG: Script stdout:', stdout)
      if (stderr) console.log('⚠️ DEBUG: Script stderr:', stderr)
      return {
        ok: false,
        message: 'Failed to run main.py. Check the error details below.',
        stdout,
        stderr: stderr || message
      }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.log('💥 DEBUG: Unexpected error:', message)
    return { ok: false, message: message || 'Unknown error' }
  }
}


