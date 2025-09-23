'use client';

import React, { useState, useRef, useEffect } from "react";
import { FaCog } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function getRandomSample<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  const used = new Set<number>();
  while (result.length < n && used.size < arr.length) {
    const idx = getRandomInt(arr.length);
    if (!used.has(idx)) {
      used.add(idx);
      result.push(arr[idx]);
    }
  }
  return result;
}

// Utility: Get random words from a specified letter column in CSV, targeting 120-130 characters
async function getRandomWordsFromColumn(file: string, letter: string, targetChars: number = 125): Promise<string[]> {
  console.log('Fetching words from:', file, 'for letter:', letter);
  const res = await fetch(file);
  const csv = await res.text();
  console.log('CSV content length:', csv.length);
  const lines = csv.trim().split(/\r?\n/);
  console.log('Number of lines:', lines.length);
  if (lines.length < 2) {
    console.log('Not enough lines in CSV');
    return [];
  }
  const headers = lines[0].split(",");
  console.log('Headers:', headers);
  const colIdx = headers.findIndex(h => h.trim().toLowerCase() === letter.toLowerCase());
  console.log('Column index for letter', letter, ':', colIdx);
  if (colIdx === -1) {
    console.log('Letter not found in headers');
    return [];
  }
  const words: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (row[colIdx] && row[colIdx].trim()) {
      words.push(row[colIdx].trim());
    }
  }
  console.log('Found words for letter', letter, ':', words.length, 'words');
  console.log('Sample words:', words.slice(0, 5));
  
  // Get a large random sample to work with
  const largeSample = getRandomSample(words, Math.min(words.length, 50));
  console.log('Large sample size:', largeSample.length);
  const selectedWords: string[] = [];
  let currentLength = 0;
  
  // Add words until we reach the target character count
  for (const word of largeSample) {
    // Account for space after each word (except the last one)
    const wordLength = word.length + (currentLength > 0 ? 1 : 0);
    
    if (currentLength + wordLength <= targetChars) {
      selectedWords.push(word);
      currentLength += wordLength;
    } else {
      // If adding this word would exceed target, stop
      break;
    }
  }
  
  console.log('Final selected words:', selectedWords);
  console.log('Total characters:', currentLength);
  return selectedWords;
}

// Utility: Split words into lines of maxLineLen (words + spaces, no word split, space after every word except very last)
function splitWordsToLineStringsWithSpaces(words: string[], maxLineLen: number): { lines: string[], prompt: string } {
  const lines: string[] = [];
  let current = '';
  let prompt = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isLastWord = i === words.length - 1;
    const wordWithSpace = isLastWord ? word : word + ' ';
    if (current.length + wordWithSpace.length > maxLineLen && current.length > 0) {
      lines.push(current);
      current = '';
    }
    current += wordWithSpace;
    prompt += wordWithSpace;
  }
  if (current.length > 0) lines.push(current);
  return { lines, prompt };
}

export default function Home() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<string[]>([]); // Each line is a string
  const [promptString, setPromptString] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [wordSet, setWordSet] = useState<'uk' | 'uk_hard' | 'hard'>('uk');
  const [letter, setLetter] = useState('a');
  const inputRef = useRef<HTMLInputElement>(null);
  const [previousWpmHistory, setPreviousWpmHistory] = useState<string[][]>([]);

  // Only show WPM and Replay when prompt is completed exactly
  const isPromptComplete = input === promptString && promptString.length > 0;

  const [startTime, setStartTime] = useState<number | null>(null);
  const [finishTime, setFinishTime] = useState<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch words and split into lines on mount or when settings change
  useEffect(() => {
    let file = '/words/uk_words.csv';
    if (wordSet === 'uk_hard') file = '/words/uk_hard_words.csv';
    if (wordSet === 'hard') file = '/words/hard_words.csv';
    console.log('useEffect triggered - wordSet:', wordSet, 'letter:', letter, 'file:', file);
    getRandomWordsFromColumn(file, letter).then(words => {
      console.log('Words received:', words);
      const { lines: lineStrs, prompt } = splitWordsToLineStringsWithSpaces(words, 50);
      console.log('Lines:', lineStrs);
      console.log('Prompt:', prompt);
      setLines(lineStrs);
      setPromptString(prompt);
      setInput("");
    }).catch(error => {
      console.error('Error fetching words:', error);
    });
  }, [wordSet, letter]);

  // On load or wordSet change, load or initialize history
  useEffect(() => {
    const key = `wpmHistory_${wordSet}`;
    const data = localStorage.getItem(key);
    let parsed: string[][][];
    if (!data) {
      parsed = getInitialWpmHistory();
      localStorage.setItem(key, JSON.stringify(parsed));
    } else {
      parsed = JSON.parse(data);
      // Defensive: if not 26, re-init
      if (!Array.isArray(parsed) || parsed.length !== 26) {
        parsed = getInitialWpmHistory();
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }
    setPreviousWpmHistory(parsed[letterIndex(letter)]);
  }, [wordSet, letter]);

  // On prompt completion, append new entry
  useEffect(() => {
    if (isPromptComplete && startTime && finishTime) {
      const wpm = calcWpm(countWords(input), startTime, finishTime);
      const now = new Date();
      const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const time = now.toTimeString().slice(0, 8); // HH:MM:SS
      const entry = [date, time, wpm.toString()];
      const key = `wpmHistory_${wordSet}`;
      const data = localStorage.getItem(key);
      let parsed: string[][][];
      if (!data) {
        parsed = getInitialWpmHistory();
      } else {
        parsed = JSON.parse(data);
        if (!Array.isArray(parsed) || parsed.length !== 26) {
          parsed = getInitialWpmHistory();
        }
      }
      const idx = letterIndex(letter);
      parsed[idx].push(entry);
      localStorage.setItem(key, JSON.stringify(parsed));
      setPreviousWpmHistory(parsed[idx]);
    }
  }, [isPromptComplete, startTime, finishTime, input, letter, wordSet]);

  // Render each line centered, with coloring
  const PALE_GREY = '#b0b0b0';
  const renderColoredPrompt = () => {
    const rendered = [];
    let globalIdx = 0;
    let caretRendered = false;
    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx];
      const lineSpans = [];
      for (let cIdx = 0; cIdx < line.length; cIdx++) {
        const char = line[cIdx];
        let color = `text-[${PALE_GREY}]`;
        let style: React.CSSProperties = { color: PALE_GREY };
        let bg: React.CSSProperties = {};
        if (input.length > globalIdx) {
          color = "text-white";
          style = { color: '#fff' };
          if (input[globalIdx] !== char) {
            if (char === ' ' || input[globalIdx] === ' ') {
              bg = { background: '#ffe066' };
            } else {
              color = "text-red-500";
              style = { color: '#ef4444' };
            }
          }
        }
        let caret = null;
        if (!caretRendered && input.length === globalIdx && !isPromptComplete) {
          caret = (
            <span
              key="caret"
              className="absolute animate-pulse"
              style={{
                left: 0,
                top: 0,
                width: '2px',
                height: '1.5em',
                background: '#fff',
                display: 'inline-block',
                zIndex: 10,
              }}
            />
          );
          caretRendered = true;
        }
        const displayChar = char === ' ' ? <span style={{ color: '#888', fontSize: '0.9em', display: 'inline-block' }}>&#9251;</span> : char;
        lineSpans.push(
          <span key={`l${lIdx}c${cIdx}`} className="relative" style={{ display: 'inline-block', position: 'relative', ...bg }}>
            {caret}
            <span className={color} style={{ ...style }}>{displayChar}</span>
          </span>
        );
        globalIdx++;
      }
      rendered.push(
        <div key={`line${lIdx}`} style={{ whiteSpace: 'pre', display: 'block', textAlign: 'center' }}>
          {lineSpans}
        </div>
      );
    }
    // If caret wasn't rendered (user at end), render at end (but only if not complete)
    if (!caretRendered && !isPromptComplete) {
      rendered.push(
        <span key="caret-end" className="relative" style={{ display: 'inline-block', position: 'relative' }}>
          <span
            className="absolute animate-pulse"
            style={{
              left: 0,
              top: 0,
              width: '2px',
              height: '1.5em',
              background: '#fff',
              display: 'inline-block',
              zIndex: 10,
            }}
          />
        </span>
      );
    }
    return rendered;
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key.length === 1 && input.length < promptString.length) {
      setInput(input + e.key);
    } else if (e.key === "Backspace" && input.length > 0) {
      setInput(input.slice(0, -1));
    } else if (e.key === "Enter" && isPromptComplete) {
      handleReplay();
    }
  };

  // Start timer on first character, pause on completion
  useEffect(() => {
    if (input.length === 1 && !startTime) {
      setStartTime(Date.now());
    }
    if (isPromptComplete && startTime && !finishTime) {
      setFinishTime(Date.now());
    }
    if (input.length === 0) {
      setStartTime(null);
      setFinishTime(null);
    }
  }, [input, isPromptComplete, startTime, finishTime]);

  // Helper to format time
  function formatTime(ts: number | null) {
    if (!ts) return '--:--:--';
    const date = new Date(ts);
    return date.toLocaleTimeString();
  }

  // Helper to format elapsed time in seconds
  function formatElapsed(start: number | null, finish: number | null) {
    if (!start || !finish) return '--';
    return ((finish - start) / 1000).toFixed(2) + 's';
  }

  // Helper to count words typed
  function countWords(str: string) {
    return str.trim().split(/\s+/).filter(Boolean).length;
  }

  // Helper to calculate WPM
  function calcWpm(words: number, start: number | null, finish: number | null) {
    if (!start || !finish) return '--';
    const elapsedMin = (finish - start) / 1000 / 60;
    if (elapsedMin === 0) return '--';
    return (words / elapsedMin).toFixed(2);
  }

  // Helper: get letter index (0 for 'a', 1 for 'b', ...)
  function letterIndex(l: string) {
    return l.toLowerCase().charCodeAt(0) - 97;
  }

  // Helper: get letter from index
  function indexToLetter(idx: number) {
    return String.fromCharCode(97 + idx);
  }

  // Helper: initialize vector of vectors
  function getInitialWpmHistory() {
    const init = [];
    for (let i = 0; i < 26; i++) {
      init.push([["2025-07-25", "00:00:00", ""]]);
    }
    return init;
  }

  // Helper: compute average WPM for a letter's history (using 5 most recent attempts)
  function averageWpm(history: string[][]) {
    // skip dummy entry
    const realEntries = history.slice(1).filter(e => e[2] && !isNaN(Number(e[2])));
    if (realEntries.length === 0) return 0;
    
    // Take only the 5 most recent attempts
    const recentEntries = realEntries.slice(-5);
    const sum = recentEntries.reduce((acc, e) => acc + Number(e[2]), 0);
    return sum / recentEntries.length;
  }

  // Helper: get all WPM history for current wordSet
  function getAllWpmHistory() {
    const key = `wpmHistory_${wordSet}`;
    const data = localStorage.getItem(key);
    let parsed: string[][][];
    if (!data) {
      parsed = getInitialWpmHistory();
      localStorage.setItem(key, JSON.stringify(parsed));
    } else {
      parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length !== 26) {
        parsed = getInitialWpmHistory();
        localStorage.setItem(key, JSON.stringify(parsed));
      }
    }
    return parsed;
  }

  // On replay, pick slowest letter for next round
  function handleReplay() {
    // Get all histories
    const allHistory = getAllWpmHistory();
    // Compute averages
    let minAvg = Infinity;
    let minIdx = 0;
    for (let i = 0; i < 26; i++) {
      const avg = averageWpm(allHistory[i]);
      if (avg === 0) {
        minIdx = i;
        break;
      }
      if (avg < minAvg) {
        minAvg = avg;
        minIdx = i;
      }
    }
    const nextLetter = indexToLetter(minIdx);
    setLetter(nextLetter);
    const file = wordSet === 'uk' ? "/words/uk_words.csv" : wordSet === 'uk_hard' ? "/words/uk_hard_words.csv" : "/words/hard_words.csv";
    getRandomWordsFromColumn(file, nextLetter).then(words => {
      const { lines: lineStrs, prompt } = splitWordsToLineStringsWithSpaces(words, 50);
      setLines(lineStrs);
      setPromptString(prompt);
      setInput("");
      setStartTime(null);
      setFinishTime(null);
    });
  }

  // Improved debug logging for Replay button logic
  console.log('Prompt:', JSON.stringify(promptString));
  console.log('Input:', JSON.stringify(input));
  console.log('Prompt length:', promptString.length);
  console.log('Input length:', input.length);
  console.log('Prompt chars:', JSON.stringify(promptString.split('')));
  console.log('Input chars:', JSON.stringify(input.split('')));
  let firstDiff = -1;
  for (let i = 0; i < Math.max(promptString.length, input.length); i++) {
    if (promptString[i] !== input[i]) {
      firstDiff = i;
      break;
    }
  }
  if (firstDiff !== -1) {
    console.log('First difference at index', firstDiff,
      'Prompt char:', JSON.stringify(promptString[firstDiff]),
      'Input char:', JSON.stringify(input[firstDiff]));
  } else {
    console.log('No difference found, strings are identical up to the shortest length.');
  }
  console.log('Input === Prompt:', input === promptString);
  console.log('isPromptComplete:', isPromptComplete);
  console.log('Prompt last char:', promptString[promptString.length - 1]);
  console.log('Input last char:', input[input.length - 1]);
  if (input.length < promptString.length) {
    console.log('Next char to type:', JSON.stringify(promptString[input.length]));
  } else if (input.length > promptString.length) {
    console.log('Extra char in input:', JSON.stringify(input[promptString.length]));
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black p-4"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: "none", position: 'relative' }}
    >
      {/* Back button in top left */}
      <button
        onClick={() => router.push('/')}
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '2rem',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '1.5rem',
          cursor: 'pointer',
          zIndex: 2000,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
        aria-label="Back to home"
        title="Back to home"
      >
        ← Back
      </button>
      {/* Settings button in top right */}
      <button
        onClick={() => setShowSettings(true)}
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '2rem',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '2rem',
          cursor: 'pointer',
          zIndex: 2000,
        }}
        aria-label="Settings"
        title="Settings"
      >
        <FaCog />
      </button>
      {/* Settings modal/popover */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{
              background: '#181818',
              color: '#fff',
              borderRadius: '1rem',
              padding: '2rem 2.5rem',
              minWidth: '340px',
              minHeight: '220px',
              boxShadow: '0 4px 32px #000a',
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSettings(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1.2rem',
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
              aria-label="Close settings"
              title="Close"
            >
              ×
            </button>
            <div style={{ marginBottom: '1.5rem', fontWeight: 'bold', fontSize: '1.3rem' }}>Settings</div>
            {/* Word section */}
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Word</div>
              <select
                value={wordSet}
                onChange={e => setWordSet(e.target.value as 'uk' | 'uk_hard' | 'hard')}
                title="Word set selection"
                style={{
                  border: '1px solid #888',
                  borderRadius: '0.4rem',
                  padding: '0.4rem 1rem',
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  background: '#222',
                  color: '#fff',
                }}
              >
                <option value="uk">UK Words (all)</option>
                <option value="uk_hard">UK Hard Words (8+ letters)</option>
                <option value="hard">Hard Words (8+ letters)</option>
              </select>
            </div>
            {/* History section */}
            <div style={{ marginTop: '2rem' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.3rem', fontSize: '1.15rem' }}>
                History
              </div>
              {previousWpmHistory.length > 0 && (
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  color: '#888',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  maxWidth: '32rem',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}>
                  <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.3rem' }}>
                    WPM History for {letter.toUpperCase()}:
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '1rem', color: '#fff', background: '#222', borderRadius: '0.5rem', overflow: 'hidden', margin: '0 auto' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '0.3rem', borderBottom: '1px solid #444' }}>Date</th>
                        <th style={{ padding: '0.3rem', borderBottom: '1px solid #444' }}>Time</th>
                        <th style={{ padding: '0.3rem', borderBottom: '1px solid #444' }}>WPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousWpmHistory.map((entry, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.2rem', textAlign: 'center' }}>{entry[0]}</td>
                          <td style={{ padding: '0.2rem', textAlign: 'center' }}>{entry[1]}</td>
                          <td style={{ padding: '0.2rem', textAlign: 'center' }}>{entry[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Letter display, Recent WPM, and Character count side by side */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        width: '100%',
        marginBottom: '0.5rem',
        flexWrap: 'wrap',
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '1.5rem',
          color: '#888',
          textAlign: 'center',
          letterSpacing: '0.1em',
        }}>
          Letter <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '2rem', marginLeft: '0.5rem' }}>{letter.toUpperCase()}</span>
        </div>
        {previousWpmHistory.length > 1 && (
          <div style={{
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            color: '#fff',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}>
            Recent WPM: {previousWpmHistory[previousWpmHistory.length - 1][2]}
          </div>
        )}
        <div style={{
          fontFamily: 'monospace',
          fontSize: '1.2rem',
          color: '#888',
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>
          Chars: <span style={{ color: '#fff', fontWeight: 'bold' }}>{promptString.length}</span>
        </div>
      </div>
      {/* Prompt display */}
      <div className="mb-8 text-4xl font-mono text-center max-w-5xl select-none" style={{ fontSize: '1.875rem', lineHeight: '2.625rem' }}>
        {renderColoredPrompt()}
      </div>
      {/* Summary box and Replay button are always present to prevent prompt shifting */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '2.5rem', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '0.25rem 1rem', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '1rem', zIndex: 1000, minHeight: '3.5rem', minWidth: '48rem' }}>
          <div style={{ minWidth: '8.5em', textAlign: 'center' }}>
            <div>Start:</div>
            <div style={{ visibility: isPromptComplete ? 'visible' : 'hidden' }}>{formatTime(startTime)}</div>
          </div>
          <div style={{ minWidth: '8.5em', textAlign: 'center' }}>
            <div>Finish:</div>
            <div style={{ visibility: isPromptComplete ? 'visible' : 'hidden' }}>{formatTime(finishTime)}</div>
          </div>
          <div style={{ minWidth: '10em', textAlign: 'center' }}>
            <div>Time elapsed:</div>
            <div style={{ visibility: isPromptComplete ? 'visible' : 'hidden' }}>{formatElapsed(startTime, finishTime)}</div>
          </div>
          <div style={{ minWidth: '8.5em', textAlign: 'center' }}>
            <div>Words typed:</div>
            <div style={{ visibility: isPromptComplete ? 'visible' : 'hidden' }}>{countWords(input)}</div>
          </div>
          <div style={{ minWidth: '8.5em', textAlign: 'center' }}>
            <div>WPM:</div>
            <div style={{ visibility: isPromptComplete ? 'visible' : 'hidden' }}>{calcWpm(countWords(input), startTime, finishTime)}</div>
          </div>
        </div>
        <button
          onClick={handleReplay}
          style={{
            background: 'none',
            border: 'none',
            cursor: isPromptComplete ? 'pointer' : 'default',
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: 0,
            padding: 0,
            marginTop: '1.5rem',
            visibility: isPromptComplete ? 'visible' : 'hidden',
            height: '3.5rem',
            width: '4.5rem',
            pointerEvents: isPromptComplete ? 'auto' : 'none',
          }}
          aria-label="Replay"
          title="Replay"
        >
          {/* SVG Replay Icon */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6"></path>
            <path d="M3 12a9 9 0 0 1 15-7.36L21 8"></path>
          </svg>
          <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1rem', marginTop: '0.5rem' }}>Replay</span>
        </button>
      </div>
      {/* Hidden input for mobile compatibility and accessibility */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        readOnly
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0, fontSize: '2.5rem' }}
        tabIndex={-1}
        aria-label="Hidden typing input"
        autoComplete="off"
        spellCheck={false}
        maxLength={promptString.length}
      />
    </div>
  );
}
