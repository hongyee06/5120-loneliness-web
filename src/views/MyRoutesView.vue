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

const socialDensity = ref('normal') // 'busy' | 'normal' | 'quiet' (UI only)
const shadeLevel = ref('normal') // 'more' | 'normal' | 'less' (UI only)

/** @type {{ lat: number, lng: number } | null} */
const userLatLng = ref(null)

let startPlace = null
let endPlace = null

let map
let geocoder
let directionsService
let directionsRenderer
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
  { id: 'WALKING', label: 'Walking' },
  { id: 'BICYCLING', label: 'Cycling' },
  { id: 'DRIVING', label: 'Driving' },
  { id: 'TRANSIT', label: 'Transit' },
]

const MELBOURNE = { lat: -37.8136, lng: 144.9631 }

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
        scale: 10,
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
  const label = isStart ? 'A' : 'B'
  const markerRef = isStart ? startMarker : destMarker

  const icon = {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 10,
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
      fontSize: '12px',
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

function initMap() {
  map = new window.google.maps.Map(mapContainerRef.value, {
    center: MELBOURNE,
    zoom: 13,
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

async function generateRoute() {
  routeError.value = ''
  routeSummary.value = ''

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
    }

    if (travelMode.value === 'TRANSIT') {
      request.transitOptions = {
        departureTime: new Date(),
      }
    }

    const result = await directionsRoute(request)
    directionsRenderer.setDirections(result)

    const leg = result.routes?.[0]?.legs?.[0]
    if (leg) {
      const dist = leg.distance?.text ?? ''
      const dur = leg.duration?.text ?? ''
      routeSummary.value = dist && dur ? `${dist} · ${dur}` : dist || dur
    }

    const routeLeg = result.routes?.[0]?.legs?.[0]
    if (routeLeg) {
      setEndpointMarker('start', routeLeg.start_location)
      setEndpointMarker('dest', routeLeg.end_location)
    }
    preferencesDirty.value = false
  } catch (e) {
    routeError.value = e?.message || 'Failed to generate route'
    directionsRenderer.setDirections(null)
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
      <h1 class="page-title">Plan Your Route</h1>

      <div class="form-group">
        <label class="form-label label-green">A Start</label>
        <div class="input-row">
          <div class="input-icon-wrapper">
            <span class="icon-magnify" aria-hidden="true">🔍</span>
            <input
              ref="startInputRef"
              v-model="startLocation"
              type="text"
              placeholder="Enter a start location"
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
              placeholder="Enter a destination"
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
      <p v-if="routeError" class="route-error">{{ routeError }}</p>

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
              ✓
            </button>
            <button
              type="button"
              :class="['pref-mid', { active: socialDensity === 'normal' }]"
              aria-label="Normal route"
              title="Normal"
              @click="setSocialDensity('normal')"
            >
              Normal
            </button>
            <button
              type="button"
              :class="['pref-icon', { active: socialDensity === 'quiet' }]"
              aria-label="Quiet route"
              title="Quiet"
              @click="setSocialDensity('quiet')"
            >
              ✕
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
              ✓
            </button>
            <button
              type="button"
              :class="['pref-mid', { active: shadeLevel === 'normal' }]"
              aria-label="Normal shade"
              title="Normal"
              @click="setShadeLevel('normal')"
            >
              Normal
            </button>
            <button
              type="button"
              :class="['pref-icon', { active: shadeLevel === 'less' }]"
              aria-label="Less shade"
              title="Less shade"
              @click="setShadeLevel('less')"
            >
              ✕
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
          <span class="legend-facility toilet-icon">WC</span> Public Toilet
        </div>
        <div class="legend-item"><span class="legend-facility bench-icon"></span> Rest Bench</div>
        <div class="legend-item">
          <span class="legend-dot user-dot"></span> My Location (click "Use My Location")
        </div>
        <div class="legend-item"><span class="legend-color route-color"></span> Planned Route</div>
        <div class="legend-item"><span class="legend-pin start-pin">A</span> Start</div>
        <div class="legend-item"><span class="legend-pin end-pin">B</span> Destination</div>
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

.page-title {
  font-size: 26px;
  font-weight: 500;
  color: #1e293b;
  margin: 0 0 32px 0;
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
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.mode-chip {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
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
}

.pref-icon,
.pref-mid {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-radius: 10px;
  cursor: pointer;
}

.pref-icon {
  width: 38px;
  height: 38px;
  font-size: 18px;
  font-weight: 900;
  display: grid;
  place-items: center;
}

.pref-mid {
  height: 38px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
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
.legend-item:last-child {
  margin-bottom: 0;
}

.legend-color {
  display: inline-block;
  width: 14px;
  height: 4px;
  border-radius: 2px;
  margin-right: 10px;
}
.route-color {
  background: #16a34a;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 10px;
  flex-shrink: 0;
}
.user-dot {
  background: #22c55e;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.legend-pin {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
}
.start-pin {
  background: #dc2626;
}
.end-pin {
  background: #dc2626;
}

.legend-facility {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.toilet-icon {
  background: #3b82f6;
}

.bench-icon {
  background: #d99a2b;
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
