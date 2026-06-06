/**
 * A custom fetch wrapper that retries transient network errors (DNS failures, connection timeouts, socket hangs)
 * and transient server errors (5xx status codes) with exponential backoff.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const maxRetries = 3
  let delay = 1000 // Start with 1 second delay
  let lastError: any = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init)

      // Only retry on transient 5xx server errors
      if (response.status >= 500) {
        throw new Error(`HTTP status ${response.status}`)
      }

      return response
    } catch (error: any) {
      lastError = error

      // If we have reached the max retry count, propagate the error
      if (attempt === maxRetries) {
        break
      }

      const errorMessage = error?.message || String(error)
      const errorStack = error?.stack || ''
      const errorCause = error?.cause?.message || error?.cause || ''

      // Identify if this is a transient network/DNS failure or timeout
      const isTransient =
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('TIMEOUT') ||
        errorMessage.includes('Timeout') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('HTTP status') ||
        errorStack.includes('ConnectTimeoutError') ||
        errorStack.includes('ENOTFOUND') ||
        String(errorCause).includes('TIMEOUT') ||
        String(errorCause).includes('ENOTFOUND')

      if (!isTransient) {
        throw error
      }

      console.warn(
        `[resilientFetch] Attempt ${attempt + 1} failed. Retrying in ${delay}ms... Error:`,
        errorMessage,
        errorCause ? `| Cause: ${errorCause}` : ''
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
      // Exponential backoff: multiply by 2, add up to 200ms of random jitter
      delay = delay * 2 + Math.floor(Math.random() * 200)
    }
  }

  throw lastError
}
