<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const mapContainerRef = ref(null)
const startInputRef = ref(null)
const destInputRef = ref(null)
const mapReady = ref(false)

const startLocation = ref('')
const destination = ref('')
const travelMode = ref(null)
const originMode = ref('manual') // 'manual' | 'current'

const routeError = ref('')
const routeSummary = ref('')
const routing = ref(false)
const preferencesDirty = ref(false)
const shadeCoverageNotice = ref(false)

const socialDensity = ref('normal') // 'busy' | 'normal' | 'quiet' (UI only)
const shadeLevel = ref('normal') // 'more' | 'normal' | 'less' (UI only)
const noToiletsFound = ref(false)
const noBenchesFound = ref(false)

/** @type {{ lat: number, lng: number } | null} */
const userLatLng = ref(null)

let startPlace = null
let endPlace = null

let map
let geocoder
let directionsService
let directionsRenderer
let placesService
let infoWindow
/** @type {google.maps.Marker[]} */
let toiletMarkers = []
/** @type {google.maps.Marker[]} */
let benchMarkers = []
/** @type {google.maps.Marker | null} */
let userMarker
/** @type {google.maps.Marker | null} */
let startMarker
/** @type {google.maps.Marker | null} */
let destMarker
let startAutocomplete
let endAutocomplete
/** @type {number | null} */
let geoWatchId = null

const TRAVEL_MODES = [
  { id: 'WALKING', label: 'Walking 🚶' },
  { id: 'BICYCLING', label: 'Cycling 🚲' },
  { id: 'DRIVING', label: 'Driving 🚗' },
  { id: 'TRANSIT', label: 'Transit 🚌' },
]

const MELBOURNE = { lat: -37.8136, lng: 144.9631 }

/** Bbox for GET /benches: dataset lives in Melbourne city; do not shrink to route bounds or distant routes miss the API window. */
const MELBOURNE_CITY_BENCH_BOUNDS = {
  minLat: -37.84,
  maxLat: -37.78,
  minLng: 144.9,
  maxLng: 145.02,
}

/**
 * Bbox for shade scoring: backend canopy data is only for Melbourne CBD.
 * If a route is far outside this bbox, skip shade API to avoid backend 500s.
 */
const MELBOURNE_CITY_SHADE_BOUNDS = {
  minLat: -37.84,
  maxLat: -37.78,
  minLng: 144.9,
  maxLng: 145.02,
}

function isPathWithinBounds(pathPoints, bounds) {
  if (!Array.isArray(pathPoints) || pathPoints.length === 0) return false
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY

  for (const p of pathPoints) {
    const lat = typeof p.lat === 'function' ? p.lat() : p.lat
    const lng = typeof p.lng === 'function' ? p.lng() : p.lng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return false

  return (
    minLat >= bounds.minLat &&
    maxLat <= bounds.maxLat &&
    minLng >= bounds.minLng &&
    maxLng <= bounds.maxLng
  )
}

function loadGoogleMapsApi() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'))
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })
}

function ensureUserMarker(position) {
  if (!map || !window.google?.maps) return

  if (userMarker) {
    userMarker.setPosition(position)
    userMarker.setMap(map)
  } else {
    userMarker = new window.google.maps.Marker({
      map,
      position,
      title: 'Your location',
      zIndex: 999,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    })
  }
}

function setEndpointMarker(kind, position) {
  if (!map || !window.google?.maps) return

  const isStart = kind === 'start'
  const label = isStart ? 'S' : 'D'
  const markerRef = isStart ? startMarker : destMarker

  const icon = {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 13,
    fillColor: '#dc2626',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  }

  if (markerRef) {
    markerRef.setPosition(position)
    markerRef.setMap(map)
    return
  }

  const marker = new window.google.maps.Marker({
    map,
    position,
    zIndex: 900,
    icon,
    label: {
      text: label,
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '800',
    },
  })

  if (isStart) startMarker = marker
  else destMarker = marker
}

function watchPositionIfSupported() {
  if (!navigator.geolocation?.watchPosition) return

  if (geoWatchId !== null) {
    navigator.geolocation.clearWatch(geoWatchId)
    geoWatchId = null
  }

  geoWatchId = navigator.geolocation.watchPosition(
    ({ coords }) => {
      const pos = { lat: coords.latitude, lng: coords.longitude }
      userLatLng.value = pos
      ensureUserMarker(pos)
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  )
}

function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude }
        userLatLng.value = pos
        ensureUserMarker(pos)
        resolve(pos)
      },
      (err) => {
        console.warn('Geolocation error:', err)
        reject(
          new Error(
            'Unable to get your location. Please allow location access in the browser or enter the start manually.',
          ),
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  })
}

function setupAutocomplete() {
  const startEl = startInputRef.value
  const endEl = destInputRef.value
  if (!startEl || !endEl || !window.google?.maps) return

  startAutocomplete = new window.google.maps.places.Autocomplete(startEl, {
    fields: ['geometry', 'formatted_address', 'name'],
    componentRestrictions: { country: 'au' },
  })
  endAutocomplete = new window.google.maps.places.Autocomplete(endEl, {
    fields: ['geometry', 'formatted_address', 'name'],
    componentRestrictions: { country: 'au' },
  })

  startAutocomplete.addListener('place_changed', () => {
    const p = startAutocomplete.getPlace()
    startPlace = p?.geometry?.location ? p : null
    if (p?.formatted_address) startLocation.value = p.formatted_address
    originMode.value = 'manual'
  })

  endAutocomplete.addListener('place_changed', () => {
    const p = endAutocomplete.getPlace()
    endPlace = p?.geometry?.location ? p : null
    if (p?.formatted_address) destination.value = p.formatted_address
  })
}

function geocodeToLatLng(address) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address, region: 'au' }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        resolve(results[0].geometry.location)
      } else {
        reject(
          new Error(
            `Unable to resolve address: "${address}". Please select an autocomplete suggestion or check spelling.`,
          ),
        )
      }
    })
  })
}

async function resolveOrigin() {
  const text = startLocation.value.trim()

  if (originMode.value === 'current' || !text || /^current\s*location$/i.test(text)) {
    if (userLatLng.value) return userLatLng.value

    const pos = await requestCurrentPosition()
    map.panTo(pos)
    map.setZoom(16)
    watchPositionIfSupported()
    return pos
  }

  if (startPlace?.geometry?.location) {
    return startPlace.geometry.location
  }

  if (!text) {
    throw new Error('Please enter a start location or click "Use My Location".')
  }

  return geocodeToLatLng(text)
}

async function resolveDestination() {
  if (endPlace?.geometry?.location) {
    return endPlace.geometry.location
  }

  const text = destination.value.trim()
  if (!text) {
    throw new Error('Please enter a destination.')
  }

  return geocodeToLatLng(text)
}

function directionsRoute(request) {
  return new Promise((resolve, reject) => {
    directionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK && result) {
        resolve(result)
      } else {
        const msg =
          status === window.google.maps.DirectionsStatus.ZERO_RESULTS
            ? 'No route found. Try another travel mode or adjust locations.'
            : `Route planning failed (${status}).`
        reject(new Error(msg))
      }
    })
  })
}

/** Clear polyline from map; `setDirections(null)` throws InvalidValueError in Maps JS API. */
function clearDirectionsDisplay() {
  if (!directionsRenderer) return
  directionsRenderer.setDirections({ routes: [] })
}

function initMap() {
  map = new window.google.maps.Map(mapContainerRef.value, {
    center: MELBOURNE,
    zoom: 13,
    mapId: 'aae9ba2249f23f6f5ac271a0',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#eef3eb' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dff1d3' }] },
    ],
  })

  geocoder = new window.google.maps.Geocoder()
  directionsService = new window.google.maps.DirectionsService()
  directionsRenderer = new window.google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#16a34a',
      strokeWeight: 5,
    },
  })
  placesService = new window.google.maps.places.PlacesService(map)
  infoWindow = new window.google.maps.InfoWindow()
}

function clearToiletMarkers() {
  for (const marker of toiletMarkers) {
    if (marker) marker.setMap(null)
  }
  toiletMarkers = []
}

function createToiletMarker(place) {
  if (!place.geometry || !place.geometry.location) return

  const marker = new window.google.maps.Marker({
    map,
    position: place.geometry.location,
    title: place.name,
    zIndex: 800,
    icon: {
      path: 'M -1.5,-1.5 L 1.5,-1.5 L 1.5,1.5 L -1.5,1.5 z',
      scale: 10,
      fillColor: '#3b82f6',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
    label: {
      text: '🚻',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '800',
    },
  })

  marker.addListener('click', () => {
    infoWindow.setContent(`
      <div style="font-family: inherit; color: #1e293b; padding: 4px;">
        <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${place.name || 'Public Toilet'}</strong>
        <span style="font-size: 13px;">Loading details...</span>
      </div>
    `)
    infoWindow.open(map, marker)

    placesService.getDetails(
      { placeId: place.place_id, fields: ['name', 'opening_hours', 'formatted_address'] },
      (details, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && details) {
          let hoursHtml =
            '<div style="font-size: 13px; margin-top: 8px;">No opening hours available.</div>'
          if (details.opening_hours?.weekday_text) {
            hoursHtml =
              '<div style="font-size: 13px; margin-top: 8px;"><strong>Opening Hours:</strong><ul style="padding-left: 16px; margin: 4px 0 0 0;">'
            details.opening_hours.weekday_text.forEach((day) => {
              hoursHtml += `<li>${day}</li>`
            })
            hoursHtml += '</ul></div>'
          } else if (details.opening_hours) {
            const isOpen = details.opening_hours.isOpen()
              ? '<span style="color:#16a34a; font-weight:700;">Open Now</span>'
              : '<span style="color:#dc2626; font-weight:700;">Closed</span>'
            hoursHtml = `<div style="font-size: 13px; margin-top: 8px;">${isOpen}</div>`
          }

          infoWindow.setContent(`
            <div style="font-family: inherit; color: #1e293b; padding: 4px; max-width: 250px;">
              <strong style="display: block; margin-bottom: 4px; font-size: 15px;">${details.name || 'Public Toilet'}</strong>
              <div style="font-size: 12px; color: #64748b;">${details.formatted_address || ''}</div>
              ${hoursHtml}
            </div>
          `)
        } else {
          infoWindow.setContent(`
            <div style="font-family: inherit; color: #1e293b; padding: 4px;">
              <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${place.name || 'Public Toilet'}</strong>
              <span style="font-size: 13px; color: #dc2626;">Failed to load opening hours.</span>
            </div>
          `)
        }
      },
    )
  })

  toiletMarkers.push(marker)
}

function getRoutePath(route) {
  if (!route) return []

  const points = []
  if (route.legs?.length) {
    for (const leg of route.legs) {
      if (!leg.steps?.length) continue
      for (const step of leg.steps) {
        if (step.path?.length) points.push(...step.path)
      }
    }
  }

  // Use detailed step paths first; fallback to overview path when needed.
  return points.length > 0 ? points : route.overview_path || []
}

/** Minimum geodesic distance from a point to the route polyline (sampled along segments; not just vertices). */
function minDistanceMetersToRoutePolyline(location, routePath) {
  const geom = window.google?.maps?.geometry?.spherical
  if (!geom || !location || routePath.length === 0) return Number.POSITIVE_INFINITY

  const loc =
    typeof location.lat === 'function'
      ? location
      : new window.google.maps.LatLng(location.lat, location.lng)

  let minDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < routePath.length - 1; i++) {
    const a = routePath[i]
    const b = routePath[i + 1]
    const segLen = geom.computeDistanceBetween(a, b)
    const stepMeters = 25
    const steps = Math.min(8000, Math.max(1, Math.ceil(segLen / stepMeters)))
    for (let s = 0; s <= steps; s++) {
      const p = geom.interpolate(a, b, s / steps)
      const d = geom.computeDistanceBetween(loc, p)
      if (d < minDist) minDist = d
    }
  }
  return minDist
}

function isNearRoutePath(location, routePath, maxDistanceMeters = 120) {
  if (!location || routePath.length === 0) return false
  return minDistanceMetersToRoutePolyline(location, routePath) <= maxDistanceMeters
}

function searchToiletsForRoute(route) {
  clearToiletMarkers()
  if (!placesService || !route) {
    noToiletsFound.value = true
    return
  }

  const bounds = route.bounds
  if (!bounds) {
    noToiletsFound.value = true
    return
  }

  const routePath = getRoutePath(route)

  const request = {
    bounds,
    query: 'public toilet',
  }

  placesService.textSearch(request, (results, status) => {
    const hasResults = Boolean(
      status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0,
    )

    if (!hasResults) {
      noToiletsFound.value = true
      return
    }

    const toiletsWithinDisplayRange = results.filter((place) => {
      const loc = place.geometry?.location
      return loc && isNearRoutePath(loc, routePath, 800)
    })

    // Alert logic: "along-route toilet" uses a tighter threshold than display range.
    const toiletsAlongRoute = toiletsWithinDisplayRange.filter((place) => {
      const loc = place.geometry?.location
      return loc && isNearRoutePath(loc, routePath, 120)
    })

    noToiletsFound.value = toiletsAlongRoute.length === 0
    for (const place of toiletsWithinDisplayRange) {
      createToiletMarker(place)
    }
  })
}

function clearBenchMarkers() {
  for (const marker of benchMarkers) {
    if (marker) marker.setMap(null)
  }
  benchMarkers = []
}

/** Same-origin in dev (Vite proxy); absolute URL in production. */
function buildBenchesFetchUrl(params) {
  const qs = params.toString()
  if (import.meta.env.DEV) {
    return `/__counseling/benches?${qs}`
  }
  const base = (
    import.meta.env.VITE_BENCHES_API_BASE ||
    import.meta.env.VITE_COUNSELING_API_BASE ||
    'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com/dev'
  ).replace(/\/$/, '')
  return `${base}/benches?${qs}`
}

/** POST target for pedestrian density scores; dev uses Vite proxy to avoid CORS. */
function buildSocialScoreFetchUrl() {
  const path = '/calculate-social-score'
  if (import.meta.env.DEV) {
    return `/__social-score${path}`
  }
  const base = (
    import.meta.env.VITE_SOCIAL_SCORE_API_BASE ||
    import.meta.env.VITE_COUNSELING_API_BASE ||
    'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com/dev'
  ).replace(/\/$/, '')
  return `${base}${path}`
}

/** POST target for tree canopy shade scores; dev uses Vite proxy to avoid CORS. */
function buildShadeScoreFetchUrl() {
  const path = '/calculate-shade-score'
  if (import.meta.env.DEV) {
    return `/__shade-score${path}`
  }
  const base = (
    import.meta.env.VITE_SHADE_SCORE_API_BASE ||
    import.meta.env.VITE_COUNSELING_API_BASE ||
    'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com/dev'
  ).replace(/\/$/, '')
  return `${base}${path}`
}

function createBenchMarker(bench) {
  if (!bench.lat || !bench.lng) return

  const marker = new window.google.maps.Marker({
    map,
    position: { lat: parseFloat(bench.lat), lng: parseFloat(bench.lng) },
    title: bench.desc || 'Rest Bench',
    zIndex: 750,
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: '#d99a2b',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    },
    label: {
      text: 'B',
      color: '#ffffff',
      fontSize: '13px',
      fontWeight: '800',
    },
  })

  marker.addListener('click', () => {
    infoWindow.setContent(`
      <div style="font-family: inherit; color: #1e293b; padding: 4px; max-width: 200px;">
        <strong style="display: block; margin-bottom: 4px; font-size: 14px;">Rest Bench</strong>
        <p style="font-size: 12px; margin: 0; color: #64748b;">${bench.desc || 'A place to rest along your journey.'}</p>
      </div>
    `)
    infoWindow.open(map, marker)
  })

  benchMarkers.push(marker)
}

/**
 * Fetches benches for Melbourne city from the backend, then keeps only points near the route polyline.
 */
async function fetchBenchesForRoute(route) {
  clearBenchMarkers()
  if (!route) {
    noBenchesFound.value = true
    return
  }

  const routePath = getRoutePath(route)
  if (routePath.length === 0) {
    noBenchesFound.value = true
    return
  }

  try {
    const params = new URLSearchParams({
      minLat: String(MELBOURNE_CITY_BENCH_BOUNDS.minLat),
      maxLat: String(MELBOURNE_CITY_BENCH_BOUNDS.maxLat),
      minLng: String(MELBOURNE_CITY_BENCH_BOUNDS.minLng),
      maxLng: String(MELBOURNE_CITY_BENCH_BOUNDS.maxLng),
    })

    const response = await fetch(buildBenchesFetchUrl(params))
    if (!response.ok) throw new Error(`Failed to fetch benches (HTTP ${response.status})`)
    const raw = await response.text()
    // Backend may emit NaN/Infinity for numeric fields; those are not valid JSON.
    const payload = JSON.parse(
      raw
        .replace(/\bNaN\b/g, 'null')
        .replace(/-Infinity\b/g, 'null')
        .replace(/\bInfinity\b/g, 'null'),
    )
    if (payload?.status !== 'success' || !Array.isArray(payload?.data)) {
      throw new Error('Unexpected benches API response')
    }

    const benchData = payload.data.map((row) => ({
      lat: row.latitude,
      lng: row.longitude,
      desc: row.description ?? '',
    }))

    // Wider than toilets: footpaths offset from the road centreline; polyline follows carriageway.
    const benchMaxDistanceMeters = 240

    const nearbyBenches = benchData.filter((bench) => {
      if (bench.lat === undefined || bench.lng === undefined) return false
      const lat = Number(bench.lat)
      const lng = Number(bench.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
      const position = new window.google.maps.LatLng(lat, lng)
      return isNearRoutePath(position, routePath, benchMaxDistanceMeters)
    })

    noBenchesFound.value = nearbyBenches.length === 0
    nearbyBenches.forEach((bench) => createBenchMarker(bench))
  } catch (error) {
    console.error('[Benches] Error fetching bench data:', error)
    noBenchesFound.value = true
  }
}

function onStartInput() {
  startPlace = null
  originMode.value = 'manual'
}

function onDestInput() {
  endPlace = null
}

async function onTravelModeChange(modeId) {
  travelMode.value = modeId
  if (!destination.value.trim() && !endPlace?.geometry?.location) return
  await generateRoute()
}

function setSocialDensity(value) {
  socialDensity.value = value
  preferencesDirty.value = true
}

function setShadeLevel(value) {
  shadeLevel.value = value
  preferencesDirty.value = true
}

function useMyLocation() {
  routeError.value = ''
  originMode.value = 'current'
  startPlace = null
  startLocation.value = 'Current location'

  const continueRouting = async () => {
    if (travelMode.value && (destination.value.trim() || endPlace)) {
      await generateRoute()
    }
  }

  if (userLatLng.value) {
    map.panTo(userLatLng.value)
    map.setZoom(16)
    watchPositionIfSupported()
    continueRouting()
    return
  }

  requestCurrentPosition()
    .then(async (pos) => {
      map.panTo(pos)
      map.setZoom(16)
      watchPositionIfSupported()
      continueRouting()
    })
    .catch((e) => {
      originMode.value = 'manual'
      routeError.value =
        e?.message ||
        'Unable to get your location. Please allow location access in the browser or enter the start manually.'
    })
}

/**
 * Fetches tree shade scores from the backend for multiple route alternatives.
 * @param {google.maps.DirectionsRoute[]} routes
 * @returns {Promise<{ id: number, shadeScore: number }[]>}
 */
async function fetchShadeAnalysis(routes) {
  if (!routes || routes.length === 0) return []

  const pathsToAnalyze = routes.map((route, i) => {
    const allPoints = getRoutePath(route)
    if (allPoints.length === 0) {
      throw new Error('A route option has no path geometry for shade analysis.')
    }
    let sampledPoints = allPoints
      .filter((_, idx) => idx % 10 === 0)
      .map((p) => ({
        lat: typeof p.lat === 'function' ? p.lat() : p.lat,
        lng: typeof p.lng === 'function' ? p.lng() : p.lng,
      }))
    if (sampledPoints.length === 0 && allPoints.length > 0) {
      sampledPoints = allPoints.map((p) => ({
        lat: typeof p.lat === 'function' ? p.lat() : p.lat,
        lng: typeof p.lng === 'function' ? p.lng() : p.lng,
      }))
    }
    return { id: i, path: sampledPoints }
  })

  const url = buildShadeScoreFetchUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routes: pathsToAnalyze }),
  })

  if (!response.ok) {
    throw new Error(`Shade score service failed (${response.status}).`)
  }

  const data = await response.json()
  const raw = Array.isArray(data.results) ? data.results : []
  const byId = new Map(raw.map((row) => [row.id, row]))
  const normalized = []
  for (let i = 0; i < routes.length; i++) {
    const row = byId.get(i)
    if (row == null || typeof row.shadeScore !== 'number' || Number.isNaN(row.shadeScore)) {
      throw new Error('Shade score service returned incomplete results.')
    }
    normalized.push({ id: i, shadeScore: row.shadeScore })
  }
  return normalized
}

/**
 * Fetches crowd density scores from the backend for multiple route alternatives.
 * @param {google.maps.DirectionsRoute[]} routes
 * @returns {Promise<{ id: number, socialScore: number }[]>}
 */
async function fetchCrowdAnalysis(routes) {
  if (!routes || routes.length === 0) return []

  const pathsToAnalyze = routes.map((route, i) => {
    const allPoints = route.overview_path || []
    let sampledPoints = allPoints
      .filter((_, idx) => idx % 10 === 0)
      .map((p) => ({
        lat: p.lat(),
        lng: p.lng(),
      }))
    if (sampledPoints.length === 0 && allPoints.length > 0) {
      sampledPoints = allPoints.map((p) => ({ lat: p.lat(), lng: p.lng() }))
    }
    return { id: i, path: sampledPoints }
  })

  const url = buildSocialScoreFetchUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routes: pathsToAnalyze }),
  })

  if (!response.ok) {
    throw new Error(`Pedestrian score service failed (${response.status}).`)
  }

  const data = await response.json()
  const raw = Array.isArray(data.results) ? data.results : []
  const byId = new Map(raw.map((row) => [row.id, row]))
  const normalized = []
  for (let i = 0; i < routes.length; i++) {
    const row = byId.get(i)
    if (row == null || typeof row.socialScore !== 'number' || Number.isNaN(row.socialScore)) {
      throw new Error('Pedestrian score service returned incomplete results.')
    }
    normalized.push({ id: i, socialScore: row.socialScore })
  }
  return normalized
}

async function generateRoute() {
  routeError.value = ''
  routeSummary.value = ''
  noToiletsFound.value = false
  noBenchesFound.value = false
  shadeCoverageNotice.value = false

  if (!directionsService || !directionsRenderer) return

  routing.value = true
  try {
    if (!travelMode.value) {
      throw new Error('Please select a travel mode first.')
    }

    const origin = await resolveOrigin()
    const dest = await resolveDestination()

    const mode = window.google.maps.TravelMode[travelMode.value]
    if (mode === undefined) {
      throw new Error('Unsupported travel mode')
    }

    const request = {
      origin,
      destination: dest,
      travelMode: mode,
      region: 'au',
      provideRouteAlternatives: true,
    }

    if (travelMode.value === 'TRANSIT') {
      request.transitOptions = {
        departureTime: new Date(),
      }
    }

    const result = await directionsRoute(request)

    // Select route based on socialDensity and shadeLevel preferences
    let bestRouteIndex = 0
    /** Crowd scores from API when social preference is used (for summary display). */
    let crowdAnalysisForSummary = []
    /** When true, shade API failed — fall back to default route index and skip shade-based sort. */
    let shadeRankingSkipped = false
    /** True when route is outside Melbourne City canopy dataset coverage. */
    let shadeCoverageLimited = false
    if (
      result.routes.length > 1 &&
      (socialDensity.value !== 'normal' || shadeLevel.value !== 'normal')
    ) {
      // 1. Fetch real data from backend if needed
      let shadeAnalysis = []
      let crowdAnalysis = []

      if (shadeLevel.value !== 'normal') {
        // Only call shade API when the route is inside the Melbourne CBD canopy coverage.
        // Otherwise, keep routing usable and simply skip shade-based ranking.
        const firstPath = getRoutePath(result.routes?.[0])
        const shadeCovered = isPathWithinBounds(firstPath, MELBOURNE_CITY_SHADE_BOUNDS)
        if (!shadeCovered) {
          shadeRankingSkipped = true
          shadeCoverageLimited = true
        } else {
          try {
            shadeAnalysis = await fetchShadeAnalysis(result.routes)
          } catch (err) {
            console.error('[Shade Analysis]', err)
            shadeRankingSkipped = true
            const m = err?.message || ''
            // If the backend fails, do not block route rendering.
            // Keep the message non-blocking and only show when user explicitly requested shade.
            routeError.value = m.includes('500')
              ? 'Shade scoring is temporarily unavailable (server error). Showing the default route.'
              : `Shade scoring is unavailable: ${m}. Showing the default route.`
          }
        }
      }
      shadeCoverageNotice.value = shadeCoverageLimited

      if (socialDensity.value !== 'normal') {
        crowdAnalysis = await fetchCrowdAnalysis(result.routes)
        crowdAnalysisForSummary = crowdAnalysis
      }

      // 2. Rank alternatives
      const scores = result.routes.map((_, i) => {
        const shadeItem = shadeAnalysis.find((item) => item.id === i)
        const crowdItem = crowdAnalysis.find((item) => item.id === i)
        let socialScore = 0
        if (socialDensity.value !== 'normal') {
          if (!crowdItem || typeof crowdItem.socialScore !== 'number') {
            throw new Error('Could not get pedestrian scores for all route options.')
          }
          socialScore = crowdItem.socialScore
        }
        let shadeScore = 0
        if (shadeLevel.value !== 'normal' && !shadeRankingSkipped) {
          if (
            !shadeItem ||
            typeof shadeItem.shadeScore !== 'number' ||
            Number.isNaN(shadeItem.shadeScore)
          ) {
            throw new Error('Could not get shade scores for all route options.')
          }
          shadeScore = shadeItem.shadeScore
        }
        return {
          index: i,
          socialScore,
          shadeScore,
        }
      })

      // Ranking logic
      scores.sort((a, b) => {
        // If shade is specified, it takes priority in this update
        if (shadeLevel.value !== 'normal' && !shadeRankingSkipped) {
          if (shadeLevel.value === 'more') return b.shadeScore - a.shadeScore
          return a.shadeScore - b.shadeScore
        }
        // Fallback to social density
        if (socialDensity.value === 'busy') return b.socialScore - a.socialScore
        if (socialDensity.value === 'quiet') return a.socialScore - b.socialScore
        return 0
      })

      bestRouteIndex = scores[0].index
      const bestScore = scores[0]
      console.log(
        `[Route Selection] Preferences: Social=${socialDensity.value}, Shade=${shadeLevel.value}`,
      )
      console.log(
        `[Route Selection] Best Route Selected Index: ${bestRouteIndex} (Shade: ${bestScore.shadeScore}%, Social: ${bestScore.socialScore}%)`,
      )
    }

    directionsRenderer.setDirections(result)
    directionsRenderer.setRouteIndex(bestRouteIndex)

    const route = result.routes?.[bestRouteIndex]
    const leg = route?.legs?.[0]
    if (leg) {
      const dist = leg.distance?.text ?? ''
      const dur = leg.duration?.text ?? ''

      let preferenceLabel = ''
      if (shadeLevel.value !== 'normal' && !shadeCoverageLimited) {
        preferenceLabel += ` · ${shadeLevel.value === 'more' ? '🌲 High' : '☀️ Low'} Shade`
      }
      if (socialDensity.value !== 'normal') {
        preferenceLabel += ` · ${socialDensity.value === 'quiet' ? 'Quiet' : 'Busy'}`
        const crowdRow = crowdAnalysisForSummary.find((c) => c.id === bestRouteIndex)
        if (crowdRow && typeof crowdRow.socialScore === 'number') {
          const s = crowdRow.socialScore
          const label = Number.isInteger(s) ? String(s) : s.toFixed(1)
          preferenceLabel += ` · Pedestrian score ${label}`
        }
      }

      routeSummary.value = dist && dur ? `${dist} · ${dur}${preferenceLabel}` : dist || dur

      setEndpointMarker('start', leg.start_location)
      setEndpointMarker('dest', leg.end_location)
    }

    searchToiletsForRoute(route)
    fetchBenchesForRoute(route)

    preferencesDirty.value = false
  } catch (e) {
    routeError.value = e?.message || 'Failed to generate route'
    clearDirectionsDisplay()
    clearToiletMarkers()
    if (startMarker) startMarker.setMap(null)
    if (destMarker) destMarker.setMap(null)
  } finally {
    routing.value = false
  }
}

onMounted(async () => {
  try {
    await loadGoogleMapsApi()
    initMap()
    await nextTick()
    setupAutocomplete()
    mapReady.value = true
  } catch (err) {
    console.error(err)
    routeError.value = err?.message || 'Failed to load map'
  }
})

onUnmounted(() => {
  if (geoWatchId !== null && navigator.geolocation?.clearWatch) {
    navigator.geolocation.clearWatch(geoWatchId)
    geoWatchId = null
  }
  clearToiletMarkers()
  clearBenchMarkers()
  if (userMarker) userMarker.setMap(null)
  userMarker = null
  if (startMarker) startMarker.setMap(null)
  startMarker = null
  if (destMarker) destMarker.setMap(null)
  destMarker = null
  directionsRenderer?.setMap(null)
  directionsRenderer = null
})
</script>

<template>
  <div class="my-routes-page">
    <aside class="sidebar">
      <header class="sidebar-header">
        <router-link to="/" class="back-link" title="Back to Home">
          <span class="back-icon">←</span>
        </router-link>
        <h1 class="page-title">Plan Your Route</h1>
      </header>

      <div class="form-group">
        <label class="form-label label-green">A Start</label>
        <div class="input-row">
          <div class="input-icon-wrapper">
            <span class="icon-magnify" aria-hidden="true">🔍</span>
            <input
              ref="startInputRef"
              v-model="startLocation"
              type="text"
              placeholder="Where do you start from?"
              autocomplete="off"
              @input="onStartInput"
            />
          </div>
          <button type="button" class="btn-sm btn-green" @click="useMyLocation">
            Use My Location
          </button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label label-red">B Destination</label>
        <div class="input-row">
          <div class="input-icon-wrapper">
            <span class="icon-magnify" aria-hidden="true">🔍</span>
            <input
              ref="destInputRef"
              v-model="destination"
              type="text"
              placeholder="Where do you want to go?"
              autocomplete="off"
              @input="onDestInput"
            />
          </div>
        </div>
      </div>

      <div class="form-group">
        <span class="form-label label-mode">Travel Mode</span>
        <div class="mode-toolbar">
          <div class="mode-row">
            <button
              v-for="m in TRAVEL_MODES"
              :key="m.id"
              type="button"
              :class="['mode-chip', { active: travelMode === m.id }]"
              @click="onTravelModeChange(m.id)"
            >
              {{ m.label }}
            </button>
          </div>
          <span v-show="routing" class="mode-spinner" aria-hidden="true" title="Updating route" />
        </div>
      </div>

      <p v-if="routeSummary" class="route-summary">Estimate: {{ routeSummary }}</p>
      <p v-if="shadeCoverageNotice" class="shade-coverage-hint">
        Shade scoring is only available within Melbourne City.
      </p>
      <p v-if="routeError" class="route-error">{{ routeError }}</p>

      <div v-if="noToiletsFound || noBenchesFound" class="route-alerts">
        <div v-if="noToiletsFound" class="alert-card warning">
          <span class="alert-icon" aria-hidden="true">⚠️</span>
          <div class="alert-content">
            <strong class="alert-title">Route notice: no public toilets</strong>
            <p class="alert-desc">
              No public toilets were found along this route. Please plan ahead.
            </p>
          </div>
        </div>
        <div v-if="noBenchesFound" class="alert-card warning">
          <span class="alert-icon" aria-hidden="true">⚠️</span>
          <div class="alert-content">
            <strong class="alert-title">Route notice: no rest benches</strong>
            <p class="alert-desc">No rest benches were found along this route.</p>
          </div>
        </div>
      </div>

      <section class="prefs">
        <h2 class="prefs-title">Route Preferences</h2>

        <div class="pref-card">
          <div class="pref-left">
            <div class="pref-name">Socially Active</div>
            <div class="pref-desc">Show routes with higher pedestrian density</div>
          </div>
          <div class="pref-actions" role="group" aria-label="Socially Active preference">
            <button
              type="button"
              :class="['pref-icon', { active: socialDensity === 'busy' }]"
              aria-label="Busy route"
              title="Busy"
              @click="setSocialDensity('busy')"
            >
              busy
            </button>
            <button
              type="button"
              :class="['pref-mid', { active: socialDensity === 'normal' }]"
              aria-label="Normal route"
              title="Normal"
              @click="setSocialDensity('normal')"
            >
              medium
            </button>
            <button
              type="button"
              :class="['pref-icon', { active: socialDensity === 'quiet' }]"
              aria-label="Quiet route"
              title="Quiet"
              @click="setSocialDensity('quiet')"
            >
              quiet
            </button>
          </div>
        </div>

        <div class="pref-card">
          <div class="pref-left">
            <div class="pref-name">Nature & Shade</div>
            <div class="pref-desc">Show routes with more tree shade</div>
          </div>
          <div class="pref-actions" role="group" aria-label="Nature & Shade preference">
            <button
              type="button"
              :class="['pref-icon', { active: shadeLevel === 'more' }]"
              aria-label="More shade"
              title="More shade"
              @click="setShadeLevel('more')"
            >
              high
            </button>
            <button
              type="button"
              :class="['pref-mid', { active: shadeLevel === 'normal' }]"
              aria-label="Normal shade"
              title="Normal"
              @click="setShadeLevel('normal')"
            >
              medium
            </button>
            <button
              type="button"
              :class="['pref-icon', { active: shadeLevel === 'less' }]"
              aria-label="Less shade"
              title="Less shade"
              @click="setShadeLevel('less')"
            >
              low
            </button>
          </div>
        </div>
        <button
          type="button"
          class="btn-generate btn-generate-prefs"
          :disabled="routing"
          @click="generateRoute"
        >
          {{
            routing
              ? 'Routing...'
              : preferencesDirty
                ? 'Generate Route — apply preferences'
                : 'Generate Route'
          }}
        </button>
      </section>
    </aside>

    <main class="map-container">
      <div ref="mapContainerRef" class="map-view"></div>

      <div v-if="!mapReady" class="map-loading-mask">Loading map…</div>

      <button type="button" class="map-view-toggle">Map View</button>

      <div class="legend-box">
        <h4>Legend</h4>
        <div class="legend-item">
          <span class="legend-facility toilet-icon">🚻</span>
          <span>Public Toilet</span>
        </div>
        <div class="legend-item">
          <span class="legend-facility bench-icon">B</span>
          <span>Rest Bench</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot user-dot"></span>
          <span>My Location</span>
        </div>
        <div class="legend-item">
          <span class="legend-color route-color"></span>
          <span>Planned Route</span>
        </div>
        <div class="legend-item">
          <span class="legend-pin start-pin">S</span>
          <span>Start</span>
        </div>
        <div class="legend-item">
          <span class="legend-pin end-pin">D</span>
          <span>Destination</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.my-routes-page {
  display: flex;
  min-height: calc(100vh - 64px);
  background: #f8fafc;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
}

.sidebar {
  width: 420px;
  background: #f8fafc;
  padding: 32px;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  text-decoration: none;
  color: #1e293b;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.back-link:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateX(-2px);
}

.back-icon {
  font-size: 20px;
  font-weight: 700;
}

.page-title {
  font-size: 26px;
  font-weight: 500;
  color: #1e293b;
  margin: 0;
}

.form-group {
  margin-bottom: 24px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
}
.label-green {
  color: #16a34a;
}
.label-red {
  color: #dc2626;
}
.label-mode {
  color: #334155;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.input-icon-wrapper {
  position: relative;
  flex: 1;
}

.input-icon-wrapper input {
  box-sizing: border-box;
  width: 100%;
  padding: 12px 14px 12px 36px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  background: #fff;
  transition: all 0.2s;
}

.input-icon-wrapper input:focus {
  border-color: #16a34a;
  box-shadow: 0 0 0 3px #dcfce7;
}

.icon-magnify {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: #94a3b8;
}

.btn-sm {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.2s;
  flex-shrink: 0;
}

.btn-green {
  background: #16a34a;
  color: white;
}
.btn-green:hover {
  background: #15803d;
}

.mode-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mode-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.mode-chip {
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.mode-chip.active {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.mode-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: #16a34a;
  border-radius: 50%;
  animation: mode-spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes mode-spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-generate {
  width: 100%;
  max-width: 220px;
  padding: 14px;
  background: #16a34a;
  color: white;
  font-weight: 700;
  font-size: 16px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  margin-top: 8px;
  margin-bottom: 16px;
  transition: background 0.2s;
}

.btn-generate-prefs {
  max-width: none;
  width: 100%;
  margin-top: 14px;
  margin-bottom: 0;
  white-space: nowrap;
  font-size: 13px;
  padding: 12px 16px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.btn-generate:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.btn-generate:hover:not(:disabled) {
  background: #15803d;
}

.route-summary {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: #166534;
  line-height: 1.4;
}

.shade-coverage-hint {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.55;
  color: #15803d; /* lighter than summary, still high-contrast */
}

.route-error {
  margin: 0 0 8px;
  font-size: 13px;
  color: #b91c1c;
}

.prefs {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
}

.prefs-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
}

.pref-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #94a3b8;
  border-radius: 12px;
  padding: 14px 12px;
  margin-bottom: 12px;
  color: #ffffff;
}

.pref-left {
  min-width: 0;
}

.pref-name {
  font-weight: 800;
  font-size: 15px;
  line-height: 1.2;
}

.pref-desc {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.95;
  line-height: 1.3;
}

.pref-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.pref-icon,
.pref-mid {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-radius: 10px;
  cursor: pointer;
  min-width: 56px;
  height: 38px;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  display: grid;
  place-items: center;
  text-transform: lowercase;
}

.pref-icon {
  min-width: 56px;
}

.pref-mid {
  min-width: 66px;
}

.pref-icon.active,
.pref-mid.active {
  background: rgba(0, 0, 0, 0.18);
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
}

.map-container {
  flex: 1;
  position: relative;
  margin: 16px 16px 16px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background: #eef3eb;
}

.map-view {
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.map-loading-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #475569;
  z-index: 5;
}

.map-view-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
  background: white;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  color: #1e293b;
  z-index: 10;
}

.legend-box {
  position: absolute;
  left: 24px;
  bottom: 24px;
  background: white;
  padding: 14px 18px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: #475569;
  z-index: 10;
  border: 1px solid #e2e8f0;
}

.legend-box h4 {
  margin: 0 0 10px 0;
  font-weight: 700;
  color: #1e293b;
  font-size: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.legend-facility {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  margin-right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.toilet-icon {
  background: #3b82f6;
  font-size: 16px;
}

.bench-icon {
  background: #d99a2b;
  border-radius: 50%;
}

.legend-pin {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
}

.start-pin,
.end-pin {
  background: #dc2626;
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-left: 5px;
  margin-right: 17px;
  flex-shrink: 0;
}

.user-dot {
  background: #22c55e;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.legend-color {
  display: inline-block;
  width: 18px;
  height: 5px;
  border-radius: 2px;
  margin-left: 3px;
  margin-right: 15px;
  flex-shrink: 0;
}

.route-color {
  background: #16a34a;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-item span:last-child {
  font-size: 14px;
  color: #334155;
  font-weight: 500;
}

.route-alerts {
  margin-top: 12px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alert-card.warning {
  background: #fffbeb;
  border: 2px solid #f59e0b;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.alert-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-title {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: #92400e;
  margin-bottom: 4px;
}

.alert-desc {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #b45309;
  line-height: 1.4;
}

@media (max-width: 1024px) {
  .my-routes-page {
    flex-direction: column;
    min-height: auto;
  }
  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid #e2e8f0;
    padding: 24px;
  }
  .map-container {
    height: 65vh;
    margin: 16px;
  }
}
</style>
