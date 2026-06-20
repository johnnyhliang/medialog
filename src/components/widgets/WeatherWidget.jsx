import { useEffect, useState, useRef } from 'react'

const DEFAULT_LOCATION = { name: 'Troy, MI', lat: 42.6064, lon: -83.1498 }
const STORAGE_KEY = 'medialog_weather_location'

const WMO_LABEL = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'icy fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'showers', 81: 'showers', 82: 'heavy showers',
  85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
}

const WMO_ICON = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

function savedLocation() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_LOCATION }
  catch { return DEFAULT_LOCATION }
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=1`
  const r = await fetch(url)
  if (!r.ok) throw new Error('weather fetch failed')
  const json = await r.json()
  const c = json.current
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature),
    wind: Math.round(c.windspeed_10m),
    code: c.weathercode,
  }
}

async function geocode(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  const r = await fetch(url)
  if (!r.ok) throw new Error('geocode failed')
  const json = await r.json()
  const result = json.results?.[0]
  if (!result) throw new Error('location not found')
  return {
    name: `${result.name}, ${result.admin1 ?? result.country}`,
    lat: result.latitude,
    lon: result.longitude,
  }
}

export default function WeatherWidget() {
  const [location, setLocation] = useState(savedLocation)
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [geocodeError, setGeocodeError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setError(false)
    fetchWeather(location.lat, location.lon)
      .then(setWeather)
      .catch(() => setError(true))
  }, [location])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function handleLocationSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setGeocodeError(false)
    try {
      const loc = await geocode(query.trim())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
      setLocation(loc)
      setWeather(null)
      setEditing(false)
      setQuery('')
    } catch {
      setGeocodeError(true)
    }
  }

  const icon = weather ? (WMO_ICON[weather.code] ?? '🌡️') : null
  const label = weather ? (WMO_LABEL[weather.code] ?? 'unknown') : null

  return (
    <div className="kw-weather">
      {!editing ? (
        <div className="kw-weather-row">
          <span className="kw-weather-icon">{icon ?? '—'}</span>
          <div className="kw-weather-info">
            {weather ? (
              <>
                <span className="kw-weather-temp">{weather.temp}°F</span>
                <span className="kw-weather-desc">{label} · feels {weather.feels}° · {weather.wind} mph</span>
              </>
            ) : error ? (
              <span className="kw-weather-desc">unavailable</span>
            ) : (
              <span className="kw-weather-desc">loading…</span>
            )}
            <button className="kw-weather-loc" onClick={() => setEditing(true)}>
              {location.name}
            </button>
          </div>
        </div>
      ) : (
        <form className="kw-weather-form" onSubmit={handleLocationSubmit}>
          <input
            ref={inputRef}
            className="kw-weather-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="city, state or zip"
          />
          <button type="submit" className="kw-weather-set">set</button>
          <button type="button" className="kw-weather-cancel" onClick={() => { setEditing(false); setGeocodeError(false); setQuery('') }}>×</button>
          {geocodeError && <span className="kw-weather-err">location not found</span>}
        </form>
      )}
    </div>
  )
}
