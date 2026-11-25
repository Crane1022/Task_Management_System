// GET /api/prayer-times?zone=WLY01   ->   { zone, date, maghrib: 'HH:MM', imsak: 'HH:MM' }
// Today's prayer times from JAKIM e-Solat, for the buka puasa countdown of the festive companion (25 Nov 2026).
// Fetched here instead of in the browser (e-Solat does not allow browser requests from other sites) and cached for an hour.
const ZONE = /^[A-Z]{3}\d{2}$/
const hm = (v) => (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v) ? v.slice(0, 5).padStart(5, '0') : '')

export default async function handler(req, res) {
  const zone = String(req.query?.zone ?? 'WLY01').toUpperCase()
  if (!ZONE.test(zone)) return res.status(400).json({ error: 'Unknown zone' })
  try {
    const r = await fetch(`https://www.e-solat.gov.my/index.php?r=esolatApi/TakwimSolat&period=today&zone=${zone}`, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(`e-Solat answered ${r.status}`)
    const j = await r.json()
    const day = Array.isArray(j?.prayerTime) ? j.prayerTime[0] : null
    const maghrib = hm(day?.maghrib)
    if (!maghrib) throw new Error('No maghrib time in the answer')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600')
    return res.status(200).json({ zone, date: day?.date ?? '', maghrib, imsak: hm(day?.imsak) })
  } catch (e) {
    // the app then uses the Director's fallback time
    return res.status(502).json({ error: e.message })
  }
}
