const dns = require('dns');
const net = require('net');
const { promisify } = require('util');

const dnsLookup = promisify(dns.lookup);

function isPrivateIp(ip) {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0') return true;
  
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(x => parseInt(x, 10));
    if (parts.length === 4) {
      const first = parts[0];
      const second = parts[1];
      
      if (first === 127) return true; // Loopback
      if (first === 10) return true;  // Private
      if (first === 169 && second === 254) return true; // Link-local
      if (first === 192 && second === 168) return true; // Private
      if (first === 172 && second >= 16 && second <= 31) return true; // Private
      if (first === 0) return true;
      if (first >= 224) return true;
    }
  } else if (net.isIPv6(ip)) {
    const cleanIp = ip.toLowerCase();
    if (cleanIp === '::1' || cleanIp === '::') return true;
    if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) {
      return true;
    }
  }
  return false;
}

async function checkUrlFrameability(urlInput) {
  let normalized = urlInput.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return { frameable: false, reason: 'invalid-url' };
  }

  try {
    const hostname = parsedUrl.hostname;
    if (parsedUrl.port && parsedUrl.port !== '80' && parsedUrl.port !== '443') {
      return { frameable: false, reason: 'ssrf-attempt' };
    }

    const lookupResult = await dnsLookup(hostname).catch(() => null);
    if (!lookupResult || !lookupResult.address) {
      return { frameable: false, reason: 'network-error' };
    }

    const ip = lookupResult.address;
    console.log('Resolved IP:', ip);
    if (isPrivateIp(ip)) {
      return { frameable: false, reason: 'ssrf-attempt' };
    }
  } catch (err) {
    console.error('DNS Lookup Error:', err);
    return { frameable: false, reason: 'network-error' };
  }

  try {
    const response = await fetch(normalized, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NuExisSignagePlayer/1.0',
      },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      console.log('Redirecting to:', location);
      if (location) {
        const redirectUrl = new URL(location, normalized).toString();
        return checkUrlFrameability(redirectUrl);
      }
    }

    const headers = response.headers;
    const xfo = headers.get('x-frame-options');
    console.log('XFO header:', xfo);
    if (xfo) {
      const val = xfo.toUpperCase().trim();
      if (val === 'DENY' || val === 'SAMEORIGIN' || val.startsWith('ALLOW-FROM')) {
        return { frameable: false, reason: 'x-frame-options' };
      }
    }

    const csp = headers.get('content-security-policy');
    console.log('CSP header:', csp);
    if (csp) {
      const directives = csp.split(';');
      for (const directive of directives) {
        const trimmed = directive.trim();
        if (trimmed.startsWith('frame-ancestors')) {
          const parts = trimmed.split(/\s+/).slice(1);
          const hasWildcard = parts.includes('*');
          if (!hasWildcard) {
            return { frameable: false, reason: 'csp-frame-ancestors' };
          }
        }
      }
    }

    return { frameable: true, reason: null };
  } catch (err) {
    console.error('Fetch Error:', err);
    return { frameable: false, reason: 'network-error' };
  }
}

checkUrlFrameability('https://nuexis.com').then(console.log);
