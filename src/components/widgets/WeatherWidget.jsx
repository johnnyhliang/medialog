import { useEffect, useState, useRef } from 'react'
import {
  Sun, Cloud, CloudSun, CloudRain, CloudSnow,
  CloudLightning, CloudDrizzle, Wind, MapPin, Thermometer,
} from 'lucide-react'

const DEFAULT_LOCATION = { name: 'Troy, MI', lat: 42.6064, lon: -83.1498 }
const STORAGE_KEY = 'medialog_weather_location'

// WMO weather interpretation codes → { label, Icon }
function wmoMeta(code) {
  if (code === 0)                      return { label: 'clear',           Icon: Sun }
  if (code <= 2)                       return { label: 'partly cloudy',   Icon: CloudSun }
  if (code === 3)                      return { label: 'overcast',        Icon: Cloud }
  if (code <= 48)                      return { label: 'foggy',           Icon: Wind }
  if (code <= 55)                      return { label: 'drizzle',         Icon: CloudDrizzle }
  if (code <= 65)                      return { label: 'rain',            Icon: CloudRain }
  if (code <= 77)                      return { label: 'snow',            Icon: CloudSnow }
  if (code <= 82)                      return { label: 'showers',         Icon: CloudRain }
  if (code <= 86)                      return { label: 'snow showers',    Icon: CloudSnow }
  return                                      { label: 'thunderstorm',    Icon: CloudLightning }
}

function savedLocation() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_LOCATION }
  catch { return DEFAULT_LOCATION }
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,windspeed_10m,apparent_temperature&temperature_unit=fahrenheit&wind_speed_unit=mph`
  const r = await fetch(url)
  if (!r.ok) throw new Error('failed')
  const { current: c } = await r.json()
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
  if (!r.ok) throw new Error('failed')
  const { results } = await r.json()
  if (!results?.[0]) throw new Error('not found')
  const hit = results[0]
  return { name: `${hit.name}, ${hit.admin1 ?? hit.country}`, lat: hit.latitude, lon: hit.longitude }
}

export default function WeatherWidget() {
  const [location, setLocation] = useState(savedLocation)
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [geocodeErr, setGeocodeErr] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setError(false)
    setWeather(null)
    fetchWeather(location.lat, location.lon).then(setWeather).catch(() => setError(true))
  }, [location])

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setGeocodeErr(false)
    try {
      const loc = await geocode(query.trim())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
      setLocation(loc)
      setEditing(false)
      setQuery('')
    } catch {
      setGeocodeErr(true)
    }
  }

  const meta = weather ? wmoMeta(weather.code) : null
  const WeatherIcon = meta?.Icon ?? Thermometer

  return (
    <div className="kw-weather">
      {!editing ? (
        <>
          <div className="kw-weather-main">
            <WeatherIcon size={20} strokeWidth={1.5} className="kw-weather-icon" />
            <div className="kw-weather-temps">
              <span className="kw-weather-temp">{weather ? `${weather.temp}°` : error ? '—' : '…'}</span>
              <span className="kw-weather-feels">
                {weather ? `feels ${weather.feels}°` : ''}
              </span>
            </div>
          </div>
          <div className="kw-weather-meta">
            {meta && <span className="kw-weather-condition">{meta.label}</span>}
            {weather && (
              <span className="kw-weather-wind">
                <Wind size={10} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                {weather.wind} mph
              </span>
            )}
          </div>
          <button className="kw-weather-loc" onClick={() => setEditing(true)}>
            <MapPin size={10} strokeWidth={2} />
            {location.name}
          </button>
        </>
      ) : (
        <form className="kw-weather-form" onSubmit={handleSubmit}>
          <MapPin size={12} strokeWidth={2} className="kw-weather-form-pin" />
          <input
            ref={inputRef}
            className="kw-weather-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="city, state…"
          />
          <button type="submit" className="kw-weather-set">set</button>
          <button
            type="button"
            className="kw-weather-cancel"
            onClick={() => { setEditing(false); setGeocodeErr(false); setQuery('') }}
          >×</button>
          {geocodeErr && <span className="kw-weather-err">not found</span>}
        </form>
      )}
    </div>
  )
}
