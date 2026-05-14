const geocodeAddress = async (address, cityName, country) => {
  const q = [address, cityName, country].filter(Boolean).join(', ')
  if (!q.trim()) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Achievo/1.0 (hello@achievo.app)',
        'Accept-Language': 'en',
      },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (err) {
    console.error('[Geocode] Failed:', err.message)
  }
  return null
}

module.exports = { geocodeAddress }
