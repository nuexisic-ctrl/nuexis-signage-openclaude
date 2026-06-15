'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets } from 'lucide-react'

interface WeatherRendererProps {
  city?: string
  unit?: 'C' | 'F'
  theme?: 'dark' | 'light'
}

export default function WeatherRenderer({ city = 'New York', unit = 'C', theme = 'dark' }: WeatherRendererProps) {
  const [weatherData, setWeatherData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Fetch or generate mock weather data for a stunning 24/7 presentation
  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      // Premium mock weather details representing a live state
      const isCelsius = unit === 'C'
      const baseTemp = isCelsius ? 24 : 75
      const mockData = {
        city: city.trim() || 'New York',
        temp: baseTemp,
        condition: 'Partly Cloudy',
        humidity: 62,
        windSpeed: isCelsius ? 12 : 8.5,
        windUnit: isCelsius ? 'km/h' : 'mph',
        forecast: [
          { day: 'Tomorrow', temp: baseTemp + 1, condition: 'Sunny' },
          { day: 'Wednesday', temp: baseTemp - 2, condition: 'Rainy' },
          { day: 'Thursday', temp: baseTemp, condition: 'Cloudy' }
        ]
      }
      setWeatherData(mockData)
      setLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [city, unit])

  const getWeatherIcon = (condition: string, size = 48) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return <Sun size={size} className="text-amber-400 animate-pulse" style={{ color: '#fbbf24' }} />
      case 'rainy':
      case 'shower':
        return <CloudRain size={size} className="text-blue-400 animate-bounce" style={{ color: '#60a5fa' }} />
      case 'snowy':
        return <CloudSnow size={size} className="text-indigo-200" style={{ color: '#e2e8f0' }} />
      case 'lightning':
      case 'stormy':
        return <CloudLightning size={size} className="text-purple-400" style={{ color: '#a78bfa' }} />
      case 'cloudy':
      case 'overcast':
        return <Cloud size={size} className="text-gray-400" style={{ color: '#94a3b8' }} />
      default:
        return <Cloud size={size} className="text-blue-300" style={{ color: '#a5b4fc' }} />
    }
  }

  if (loading) {
    return (
      <div style={{ color: 'white', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#07111f' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: '#3b82f6', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          <div>Loading Weather forecast...</div>
        </div>
      </div>
    )
  }

  if (!weatherData) return null

  const isDark = theme === 'dark'

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '2rem',
    background: isDark 
      ? 'radial-gradient(circle at center, #0d1e36 0%, #07111f 100%)' 
      : 'radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%)',
    color: isDark ? '#ffffff' : '#0f172a',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '500px',
    padding: '2.5rem',
    borderRadius: '24px',
    background: isDark ? 'rgba(13, 29, 51, 0.65)' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(16px)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
    textAlign: 'center'
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>{weatherData.city}</h2>
        <div style={{ fontSize: '1rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>Current Weather</div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', margin: '2rem 0' }}>
          {getWeatherIcon(weatherData.condition, 80)}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1, fontFamily: 'sans-serif' }}>
              {weatherData.temp}°{unit}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#3b82f6', marginTop: '0.25rem' }}>{weatherData.condition}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', margin: '0 0 2rem', padding: '1rem 0', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wind size={20} style={{ color: '#3b82f6' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}>Wind</div>
              <div style={{ fontWeight: 600 }}>{weatherData.windSpeed} {weatherData.windUnit}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={20} style={{ color: '#10b981' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}>Humidity</div>
              <div style={{ fontWeight: 600 }}>{weatherData.humidity}%</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          {weatherData.forecast.map((f: any, idx: number) => (
            <div key={idx} style={{ flex: 1, padding: '12px', borderRadius: '16px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}>{f.day}</div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                {getWeatherIcon(f.condition, 28)}
              </div>
              <div style={{ fontWeight: 800 }}>{f.temp}°{unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
