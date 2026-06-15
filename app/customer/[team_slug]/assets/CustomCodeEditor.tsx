'use client'

import React, { useRef, useEffect } from 'react'
import styles from './Modal.module.css'

// ── CUSTOM LIGHTWEIGHT IDE SYNTAX HIGHLIGHTING (NORD PALETTE) ──────────────

function highlightHtml(code: string): string {
  if (!code) return ''
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Nord comments (muted slate grey-green)
  html = html.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span style="color: #4c566a; font-style: italic;">$1</span>')
  
  // Quoted attribute values (Nord soft emerald green)
  html = html.replace(/("[^"]*")/g, '<span style="color: #a3be8c;">$1</span>')
  html = html.replace(/('[^']*')/g, '<span style="color: #a3be8c;">$1</span>')

  // HTML brackets & tags (Nord bright developer blue)
  html = html.replace(/(&lt;\/?[a-zA-Z0-9-]+)/g, '<span style="color: #81a1c1; font-weight: 600;">$1</span>')
  html = html.replace(/(&gt;)/g, '<span style="color: #81a1c1; font-weight: 600;">$1</span>')

  // Attribute keys (Nord frost teal)
  html = html.replace(/(\s)([a-zA-Z0-9-]+)(?=\s*=)/g, '$1<span style="color: #8fbcbb;">$2</span>')

  return html
}

function highlightCss(code: string): string {
  if (!code) return ''
  let css = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // CSS Comments (Nord slate grey)
  css = css.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #4c566a; font-style: italic;">$1</span>')

  // CSS Selectors (Nord bright cyan/blue)
  css = css.replace(/([^\r\n{}]+)(?=\s*\{)/g, '<span style="color: #88c0d0; font-weight: 600;">$1</span>')

  // CSS Properties (Nord soft frost blue)
  css = css.replace(/([a-zA-Z0-9-]+)(?=\s*:)/g, '<span style="color: #81a1c1;">$1</span>')

  // CSS Values (Nord pastel purple/pink)
  css = css.replace(/(:\s*)([^;}\r\n]+)/g, '$1<span style="color: #b48ead;">$2</span>')

  // Punctuation braces
  css = css.replace(/([{}])/g, '<span style="color: #d8dee9;">$1</span>')

  return css
}

const bracesMap = new Map<string, string>([
  ['{', '}'],
  ['[', ']'],
  ['(', ')'],
  ['"', '"'],
  ["'", "'"],
  ['<', '>']
])

interface CustomCodeEditorProps {
  value: string
  onChange: (v: string) => void
  language: 'html' | 'css'
}

export default function CustomCodeEditor({
  value,
  onChange,
  language
}: CustomCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  const syncScroll = () => {
    if (textareaRef.current) {
      if (backdropRef.current) {
        backdropRef.current.scrollTop = textareaRef.current.scrollTop
        backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
      }
      if (gutterRef.current) {
        gutterRef.current.scrollTop = textareaRef.current.scrollTop
      }
    }
  }

  // Ensure scroll sync triggers when code loads or is reset
  useEffect(() => {
    syncScroll()
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget
    const val = textarea.value
    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // 1. Tab Indent: Insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const newValue = val.substring(0, start) + '  ' + val.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    // 2. Bracket & Quote Autopairing (using safe ES6 Map)
    if (bracesMap.has(e.key)) {
      e.preventDefault()
      const closingChar = bracesMap.get(e.key) || ''
      const newValue = val.substring(0, start) + e.key + closingChar + val.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
      return
    }

    // 3. HTML Tag Auto-closing on typing '>'
    if (e.key === '>') {
      const textBefore = val.substring(0, start)
      const tagMatch = textBefore.match(/<([a-zA-Z0-9-]+)(?:\s+[^>]*?)?$/)
      if (tagMatch) {
        const tagName = tagMatch[1]
        const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
        if (!voidElements.has(tagName.toLowerCase())) {
          e.preventDefault()
          const newValue = val.substring(0, start) + '></' + tagName + '>' + val.substring(end)
          onChange(newValue)
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 1
          }, 0)
        }
      }
    }
  }

  const lines = value.split('\n')
  const highlighted = language === 'html' ? highlightHtml(value) : highlightCss(value)

  return (
    <div style={{
      display: 'flex',
      height: '220px',
      background: '#2e3440',
      borderRadius: '10px',
      border: '1.5px solid var(--outline-variant)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Line Numbers gutter */}
      <div 
        ref={gutterRef}
        className={styles.editorBackdrop}
        style={{
          width: '42px',
          background: '#242933',
          color: '#5e6a80',
          padding: '12px 0',
          textAlign: 'right',
          userSelect: 'none',
          borderRight: '1.5px solid #3b4252',
          overflow: 'hidden',
          height: '100%',
          lineHeight: '20px',
          boxSizing: 'border-box'
        }}
      >
        {lines.map((_, i) => (
          <div key={i} style={{ paddingRight: '8px', fontSize: '11px', fontWeight: 600 }}>{i + 1}</div>
        ))}
      </div>

      {/* Editor viewport container */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        {/* Background Syntax Display */}
        <div 
          ref={backdropRef}
          className={styles.editorBackdrop}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            padding: '12px',
            boxSizing: 'border-box',
            whiteSpace: 'pre',
            overflow: 'hidden',
            pointerEvents: 'none',
            color: '#d8dee9',
            lineHeight: '20px',
            zIndex: 1
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />

        {/* User Interactive Textarea Overlay */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          className={styles.editorTextarea}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            color: 'transparent',
            caretColor: '#88c0d0',
            border: 'none',
            outline: 'none',
            padding: '12px',
            boxSizing: 'border-box',
            resize: 'none',
            lineHeight: '20px',
            whiteSpace: 'pre',
            overflow: 'auto',
            zIndex: 2
          }}
        />
      </div>
    </div>
  )
}
