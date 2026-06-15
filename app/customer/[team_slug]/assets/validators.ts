/**
 * Real-time HTML tag matching and validation.
 * Scans for opened and closed tags, tracking them using a stack-based algorithm.
 * Flags unclosed tags, mismatched tags, and stray closing tags.
 */
export function validateHtml(html: string): string[] {
  const errors: string[] = []
  if (!html) return errors

  // Match tags like <div class="...">, </div>, or self-closing tags like <br />
  const tagRegex = /<(\/?)([a-zA-Z0-9-]+)(?:\s+[^>]*?)?(\/?)>/g
  const stack: { name: string; line: number }[] = []

  const lines = html.split('\n')
  const getLineNumber = (index: number): number => {
    let currentLength = 0
    for (let i = 0; i < lines.length; i++) {
      currentLength += (lines.at(i) || '').length + 1 // +1 for newline character
      if (currentLength > index) {
        return i + 1
      }
    }
    return lines.length
  }

  // Void elements that do not require closing tags
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ])

  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = !!match[1]
    const tagName = match[2].toLowerCase()
    const isSelfClosing = !!match[3]
    const index = match.index
    const line = getLineNumber(index)

    // Skip self-closing tags and standard void elements
    if (isSelfClosing || voidElements.has(tagName)) {
      continue
    }

    if (isClosing) {
      if (stack.length === 0) {
        errors.push(`HTML Error (Line ${line}): Stray closing tag </${tagName}> found without a matching open tag.`)
      } else {
        const top = stack.pop()
        if (top && top.name !== tagName) {
          errors.push(`HTML Error (Line ${line}): Mismatched tags. Found </${tagName}>, but the last opened tag was <${top.name}> on line ${top.line}.`)
          // Put the mismatched tag back on stack to avoid cascading mismatch warnings
          stack.push(top)
        }
      }
    } else {
      stack.push({ name: tagName, line })
    }
  }

  // Any remaining tags in the stack are unclosed
  while (stack.length > 0) {
    const unclosed = stack.pop()
    if (unclosed) {
      errors.push(`HTML Warning (Line ${unclosed.line}): Unclosed tag <${unclosed.name}>. Make sure to close it with </${unclosed.name}>.`)
    }
  }

  return errors
}

/**
 * Real-time CSS validation.
 * Checks for symmetrical curly braces and scans rules inside blocks for missing colons, semicolons, or empty properties.
 */
export function validateCss(css: string): string[] {
  const errors: string[] = []
  if (!css) return errors

  const lines = css.split('\n')
  let openBraces = 0
  let inBlock = false

  for (let i = 0; i < lines.length; i++) {
    let line = (lines.at(i) || '').trim()
    const lineNum = i + 1

    // Strip comments
    line = line.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (!line) continue

    // Track brace symmetry
    for (const char of line) {
      if (char === '{') {
        openBraces++
        inBlock = true
      } else if (char === '}') {
        openBraces--
        if (openBraces === 0) {
          inBlock = false
        }
      }
    }

    if (openBraces < 0) {
      errors.push(`CSS Error (Line ${lineNum}): Stray closing brace '}' without a matching opening '{'.`)
      openBraces = 0 // Reset to avoid cascading errors
      inBlock = false
    }

    // Inside ruleset validation
    // Verify properties and declarations have colons/semicolons
    if (inBlock && !line.includes('{') && !line.includes('}')) {
      // Ignore nesting rules or pseudo queries for base validation
      if (line.startsWith('@') || line.startsWith('&') || line.startsWith('/*')) {
        continue
      }

      if (!line.includes(':')) {
        errors.push(`CSS Warning (Line ${lineNum}): Malformed declaration "${line}". Expected 'property: value;'.`)
      } else {
        const parts = line.split(':')
        const prop = parts[0].trim()
        const val = parts.slice(1).join(':').trim()

        if (!prop) {
          errors.push(`CSS Error (Line ${lineNum}): Empty property name before colon.`)
        }
        if (!val || val === ';') {
          errors.push(`CSS Error (Line ${lineNum}): Missing property value after colon.`)
        } else if (!val.endsWith(';') && !val.endsWith('}') && !(lines.at(i + 1) || '').trim().startsWith('}')) {
          errors.push(`CSS Warning (Line ${lineNum}): Rule is missing a trailing semicolon ';'.`)
        }
      }
    }
  }

  if (openBraces > 0) {
    errors.push(`CSS Warning: Unclosed code block detected. Missing ${openBraces} closing brace(s) '}'.`)
  }

  return errors
}
