import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return new NextResponse('Missing url parameter', { status: 400 })
  }

  try {
    const parsedUrl = new URL(targetUrl)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return new NextResponse('Invalid protocol', { status: 400 })
    }

    // Fetch the target URL content
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch: ${response.statusText}`, { status: response.status })
    }

    const contentType = response.headers.get('content-type') || ''
    
    // We only rewrite HTML. For images/stylesheets/etc. the <base> tag handles resolution.
    if (contentType.includes('text/html')) {
      let html = await response.text()
      
      // Inject <base href="..."> into <head> to resolve relative URLs automatically
      const baseUrl = targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`
      const baseTag = `<base href="${baseUrl}">`
      
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>\n${baseTag}`)
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>\n${baseTag}`)
      } else {
        html = `${baseTag}\n${html}`
      }

      // Create new headers, stripping frame options and CSP which block iframe embedding
      const headers = new Headers()
      headers.set('Content-Type', 'text/html; charset=utf-8')
      headers.set('Access-Control-Allow-Origin', '*')
      
      // Strip framing restrictions
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase()
        if (
          lowerKey !== 'x-frame-options' && 
          lowerKey !== 'content-security-policy' && 
          lowerKey !== 'content-security-policy-report-only' &&
          lowerKey !== 'content-encoding' &&
          lowerKey !== 'content-length' &&
          lowerKey !== 'transfer-encoding'
        ) {
          headers.set(key, value)
        }
      })

      return new NextResponse(html, {
        status: response.status,
        headers
      })
    } else {
      // Pass through other types of files (images, JSON, etc.) if fetched directly
      const body = await response.blob()
      const headers = new Headers()
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase()
        if (
          lowerKey !== 'x-frame-options' && 
          lowerKey !== 'content-security-policy' && 
          lowerKey !== 'content-security-policy-report-only' &&
          lowerKey !== 'content-encoding' &&
          lowerKey !== 'content-length' &&
          lowerKey !== 'transfer-encoding'
        ) {
          headers.set(key, value)
        }
      })
      headers.set('Access-Control-Allow-Origin', '*')

      return new NextResponse(body, {
        status: response.status,
        headers
      })
    }
  } catch (error: any) {
    console.error('[Proxy API Error]:', error)
    return new NextResponse(`Proxy error: ${error.message}`, { status: 500 })
  }
}
