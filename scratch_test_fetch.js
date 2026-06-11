async function check(urlInput) {
  let normalized = urlInput.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }
  console.log('Fetching:', normalized);
  try {
    const response = await fetch(normalized, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NuExisSignagePlayer/1.0',
      },
      redirect: 'manual',
    });
    console.log('Status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      console.log('Redirect location:', location);
      if (location) {
        const redirectUrl = new URL(location, normalized).toString();
        return check(redirectUrl);
      }
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

check('https://nuexis.com');
