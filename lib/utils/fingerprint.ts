import fpPromise from '@fingerprintjs/fingerprintjs';

export async function getHardwareId(): Promise<string> {
  // Try to get from localStorage first (most reliable across same-browser sessions)
  if (typeof window !== 'undefined') {
    const storedId = localStorage.getItem('nuexis_hardware_id');
    if (storedId) {
      return storedId;
    }
  }

  // If no stored ID, generate browser fingerprint
  const fp = await fpPromise.load();
  const result = await fp.get();
  const hardwareId = result.visitorId;

  // Save it back to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('nuexis_hardware_id', hardwareId);
  }
  
  return hardwareId;
}
