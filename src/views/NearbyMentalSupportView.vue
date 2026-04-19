<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const MELBOURNE_CENTER = { lat: -37.8136, lng: 144.9631 }
const DEFAULT_COUNSELING_API_BASE =
  'https://gdxi2b3eqa.execute-api.ap-southeast-2.amazonaws.com/dev'

/** When DB centers sit in the CBD but the user is far away, first query uses this radius (m). */
const DEFAULT_SEARCH_RADIUS_METERS = 90000
/** If nothing is returned around the user, query around Melbourne CBD (m) then sort by distance to the user. */
const CBD_ANCHOR_FALLBACK_RADIUS_METERS = 12000

function pickValidApiBase(...candidates) {
  for (const raw of candidates) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) continue
    // Ignore placeholder examples accidentally copied into production env vars.
    if (/xxxx|example|your-api/i.test(value)) continue
    const normalized = value.replace(/\/$/, '')
    try {
      const parsed = new URL(normalized)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return normalized
    } catch {
      // Skip malformed URLs and continue trying the next candidate.
    }
  }
  return DEFAULT_COUNSELING_API_BASE
}

const mapContainerRef = ref(null)
const queryInputRef = ref(null)
const query = ref('')
const queryPlace = ref(null)
const filterCenter = ref(null)
const mapReady = ref(false)
const loadingRooms = ref(false)
const applyingAddressFilter = ref(false)
const roomsFetchError = ref('')
const addressFilterError = ref('')
const selectedRoomId = ref(null)
const userPosition = ref(null)
const travelMode = ref('WALKING')
const routing = ref(false)

const rooms = ref([])
const routeSummary = ref('')

let map
let userMarker
let filterCenterMarker
let directionsService
let directionsRenderer
let placesService
let queryAutocomplete
const roomMarkers = []
/** @type {google.maps.Marker | null} */
let startMarker = null
/** @type {google.maps.Marker | null} */
let destMarker = null

const TRAVEL_MODES = [
  { id: 'WALKING', label: 'Walking 🚶' },
  { id: 'BICYCLING', label: 'Cycling 🚲' },
  { id: 'DRIVING', label: 'Driving 🚗' },
  { id: 'TRANSIT', label: 'Transit 🚌' },
]

function formatWalkDuration(durationText) {
  if (!durationText) return '--'
  return /walk/i.test(durationText) ? durationText : `${durationText} walk`
}

function parseDistanceToMeters(distanceText) {
  if (!distanceText) return Number.POSITIVE_INFINITY
  const text = distanceText.toLowerCase().replace(/,/g, '').trim()
  if (text.endsWith('km')) return Number.parseFloat(text) * 1000
  if (text.endsWith('m')) return Number.parseFloat(text)
  return Number.POSITIVE_INFINITY
}

/** Backend `distance_meters` → list sort / display until Distance Matrix updates. */
function formatDistanceMeters(meters) {
  const m = Number(meters)
  if (!Number.isFinite(m) || m < 0) return ''
  if (m < 1000) return `${Math.round(m)}m`
  const km = m / 1000
  const rounded = Math.round(km * 10) / 10
  return `${rounded}km`
}

/** Straight-line distance between two WGS84 points (meters). */
function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function sortRoomsByWalkingDistance() {
  rooms.value = [...rooms.value].sort(
    (a, b) => parseDistanceToMeters(a.distanceText) - parseDistanceToMeters(b.distanceText),
  )
}

function loadGoogleMapsApi() {
  if (window.google?.maps) return Promise.resolve(window.google.maps)

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return Promise.reject(
      new Error('Missing VITE_GOOGLE_MAPS_API_KEY. Please configure it in your .env file.'),
    )
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${apiKey}` +
      '&libraries=places,geometry&v=weekly'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Failed to load Google Maps script.'))
    document.head.appendChild(script)
  })
}

function clearRoomMarkers() {
  roomMarkers.forEach((marker) => marker.setMap(null))
  roomMarkers.length = 0
}

function renderRoomMarkers() {
  if (!map || !window.google?.maps) return

  clearRoomMarkers()
  rooms.value.forEach((room) => {
    const marker = new window.google.maps.Marker({
      map,
      position: room.position,
      title: room.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
      },
    })

    marker.addListener('click', () => selectRoomAndRoute(room))
    roomMarkers.push(marker)
  })
}

function setUserMarker(position) {
  if (!map || !window.google?.maps) return

  userPosition.value = position
  if (userMarker) {
    userMarker.setPosition(position)
  } else {
    userMarker = new window.google.maps.Marker({
      map,
      position,
      title: 'Your location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#16a34a',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
      },
    })
  }
}

function setFilterCenterMarker(position) {
  if (!map || !window.google?.maps) return

  if (filterCenterMarker) {
    filterCenterMarker.setPosition(position)
    filterCenterMarker.setMap(map)
    return
  }

  filterCenterMarker = new window.google.maps.Marker({
    map,
    position,
    title: 'Filtered address',
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: '#7c3aed',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#ffffff',
    },
    zIndex: 910,
  })
}

function clearAddressFilterState() {
  filterCenter.value = null
  queryPlace.value = null
  addressFilterError.value = ''
  if (filterCenterMarker) filterCenterMarker.setMap(null)
}

function setEndpointMarker(kind, position) {
  if (!map || !window.google?.maps) return

  const isStart = kind === 'start'
  const labelText = isStart ? 'S' : 'D'

  const icon = {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: 13,
    fillColor: '#dc2626',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 3,
  }

  if (isStart && startMarker) {
    startMarker.setPosition(position)
    startMarker.setMap(map)
    return
  }
  if (!isStart && destMarker) {
    destMarker.setPosition(position)
    destMarker.setMap(map)
    return
  }

  const marker = new window.google.maps.Marker({
    map,
    position,
    zIndex: 900,
    icon,
    label: {
      text: labelText,
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '800',
    },
  })

  if (isStart) startMarker = marker
  else destMarker = marker
}

async function resolveAddressFromPlaces(address) {
  if (!placesService) throw new Error('Map is not ready yet.')
  return new Promise((resolve, reject) => {
    placesService.findPlaceFromQuery(
      {
        query: address,
        fields: ['geometry', 'formatted_address', 'name'],
      },
      (results, status) => {
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          results?.[0]?.geometry?.location
        ) {
          const location = results[0].geometry.location
          const fallbackLabel = results[0].name || address
          const formattedAddress = results[0].formatted_address || fallbackLabel
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            formattedAddress,
          })
          return
        }
        reject(new Error('Address not found. Please pick one from the suggestions.'))
      },
    )
  })
}

function buildCounselingCentersFetchUrl(lat, lng, radiusMeters) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
  })
  if (import.meta.env.DEV) {
    return `/__counseling/counseling-centers?${params}`
  }
  const base = pickValidApiBase(import.meta.env.VITE_COUNSELING_API_BASE)
  return `${base}/counseling-centers?${params}`
}

async function fetchCounselingCentersRows(lat, lng, radiusMeters) {
  const response = await fetch(buildCounselingCentersFetchUrl(lat, lng, radiusMeters))
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()
  if (payload?.status !== 'success' || !Array.isArray(payload?.data)) {
    throw new Error('Unexpected API response')
  }
  return payload.data
}

async function fetchRoomsNearby(userOrigin) {
  loadingRooms.value = true
  roomsFetchError.value = ''
  try {
    const envRadius = Number(import.meta.env.VITE_COUNSELING_SEARCH_RADIUS_METERS)
    const primaryRadius =
      Number.isFinite(envRadius) && envRadius > 0 ? envRadius : DEFAULT_SEARCH_RADIUS_METERS

    let rows = await fetchCounselingCentersRows(userOrigin.lat, userOrigin.lng, primaryRadius)
    let distanceFromUser = true
    if (rows.length === 0) {
      rows = await fetchCounselingCentersRows(
        MELBOURNE_CENTER.lat,
        MELBOURNE_CENTER.lng,
        CBD_ANCHOR_FALLBACK_RADIUS_METERS,
      )
      distanceFromUser = false
    }

    rooms.value = rows.map((item) => {
      const position = { lat: Number(item.latitude), lng: Number(item.longitude) }
      const meters = distanceFromUser
        ? Number(item.distance_meters)
        : haversineMeters(userOrigin, position)
      return {
        id: item.id,
        name: item.name,
        address: item.address,
        position,
        distanceText: formatDistanceMeters(meters),
        durationText: '',
      }
    })
    sortRoomsByWalkingDistance()
  } catch (err) {
    console.error('counseling-centers', err)
    rooms.value = []
    roomsFetchError.value =
      'Unable to load nearby counseling centers. Please try again later, or check your network and API configuration (CORS must allow your site in production).'
  } finally {
    loadingRooms.value = false
    renderRoomMarkers()
  }
}

/** Google Distance Matrix allows at most 25 destinations per request (1 origin here). */
const DISTANCE_MATRIX_MAX_DESTINATIONS = 25

async function updateDistanceDurationForAll(origin) {
  if (!window.google?.maps || rooms.value.length === 0) return

  const service = new window.google.maps.DistanceMatrixService()
  const list = rooms.value
  const elementsByIndex = []

  for (let offset = 0; offset < list.length; offset += DISTANCE_MATRIX_MAX_DESTINATIONS) {
    const slice = list.slice(offset, offset + DISTANCE_MATRIX_MAX_DESTINATIONS)
    const destinations = slice.map((room) => room.position)
    const result = await service.getDistanceMatrix({
      origins: [origin],
      destinations,
      travelMode: window.google.maps.TravelMode.WALKING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
    })
    const row = result?.rows?.[0]?.elements || []
    for (let i = 0; i < slice.length; i++) {
      elementsByIndex[offset + i] = row[i]
    }
  }

  rooms.value = rooms.value.map((room, index) => {
    const info = elementsByIndex[index]
    if (!info || info.status !== 'OK') return room
    return {
      ...room,
      distanceText: info.distance?.text || room.distanceText,
      durationText: info.duration?.text || room.durationText,
    }
  })
  sortRoomsByWalkingDistance()
}

async function locateUser() {
  // Explicitly switch back to realtime location as the route/list origin.
  clearAddressFilterState()
  clearSelectedRoom()

  if (!navigator.geolocation) {
    await fetchRoomsNearby(MELBOURNE_CENTER)
    await updateDistanceDurationForAll(MELBOURNE_CENTER)
    return
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const current = { lat: coords.latitude, lng: coords.longitude }
      setUserMarker(current)
      map.panTo(current)
      await fetchRoomsNearby(current)
      await updateDistanceDurationForAll(current)
    },
    async () => {
      setUserMarker(MELBOURNE_CENTER)
      await fetchRoomsNearby(MELBOURNE_CENTER)
      await updateDistanceDurationForAll(MELBOURNE_CENTER)
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

async function drawRoute(origin, destination, mode = travelMode.value) {
  if (!directionsService || !directionsRenderer || !window.google?.maps) return

  const request = {
    origin,
    destination,
    travelMode: window.google.maps.TravelMode[mode],
  }
  if (mode === 'TRANSIT') request.transitOptions = { departureTime: new Date() }

  const result = await directionsService.route(request)

  directionsRenderer.setDirections(result)
  const leg = result?.routes?.[0]?.legs?.[0]
  if (leg) {
    routeSummary.value = `${leg.distance?.text || ''} | ${leg.duration?.text || ''}`
    setEndpointMarker('start', leg.start_location)
    setEndpointMarker('dest', leg.end_location)
  }
}

async function selectRoomAndRoute(room) {
  selectedRoomId.value = room.id

  const origin = filterCenter.value || userPosition.value || MELBOURNE_CENTER
  routing.value = true
  try {
    await drawRoute(origin, room.position)
  } finally {
    routing.value = false
  }
}

async function generateSelectedRoute() {
  const selectedRoom = rooms.value.find((room) => room.id === selectedRoomId.value)
  if (!selectedRoom) return

  const origin = filterCenter.value || userPosition.value || MELBOURNE_CENTER
  routing.value = true
  try {
    await drawRoute(origin, selectedRoom.position, travelMode.value)
  } finally {
    routing.value = false
  }
}

function clearSelectedRoom() {
  selectedRoomId.value = null
  if (startMarker) startMarker.setMap(null)
  if (destMarker) destMarker.setMap(null)
  directionsRenderer?.setDirections({ routes: [] })
  routeSummary.value = ''
}

async function selectTravelMode(modeId) {
  travelMode.value = modeId
  await generateSelectedRoute()
}

function getCurrentLocationLabel() {
  if (filterCenter.value?.formattedAddress) return filterCenter.value.formattedAddress
  return userPosition.value ? 'Current location' : 'Melbourne CBD'
}

const filteredRooms = computed(() => {
  if (!filterCenter.value) return rooms.value

  const anchor = filterCenter.value
  const withDistance = rooms.value.map((room) => ({
    room,
    meters: haversineMeters(anchor, room.position),
  }))

  const NEARBY_DISTANCE_METERS = 5000
  let nearRooms = withDistance.filter((item) => item.meters <= NEARBY_DISTANCE_METERS)
  if (nearRooms.length === 0) {
    nearRooms = withDistance
  }

  return nearRooms.sort((a, b) => a.meters - b.meters).map((item) => item.room)
})

const selectedRoom = computed(
  () => rooms.value.find((room) => room.id === selectedRoomId.value) || null,
)

const displayedRooms = computed(() => {
  if (selectedRoom.value) return [selectedRoom.value]
  return filteredRooms.value
})

async function applyAddressFilter() {
  addressFilterError.value = ''
  const address = query.value.trim()
  if (!address) {
    addressFilterError.value = 'Please enter an address first.'
    return
  }

  applyingAddressFilter.value = true
  try {
    const target = queryPlace.value || (await resolveAddressFromPlaces(address))
    filterCenter.value = target
    setFilterCenterMarker({ lat: target.lat, lng: target.lng })
    map.panTo({ lat: target.lat, lng: target.lng })
    if (map.getZoom() < 13) map.setZoom(13)
    await updateDistanceDurationForAll(target)
    selectedRoomId.value = null
  } catch (err) {
    addressFilterError.value = err?.message || 'Failed to apply address filter.'
  } finally {
    applyingAddressFilter.value = false
  }
}

function onQueryInput() {
  // Clear the previously selected suggestion coordinates after manual input changes to avoid mismatches.
  queryPlace.value = null
}

function setupQueryAutocomplete() {
  const input = queryInputRef.value
  if (!input || !window.google?.maps?.places) return

  queryAutocomplete = new window.google.maps.places.Autocomplete(input, {
    fields: ['geometry', 'formatted_address', 'name'],
    componentRestrictions: { country: 'au' },
  })

  queryAutocomplete.addListener('place_changed', () => {
    const place = queryAutocomplete.getPlace()
    if (!place?.geometry?.location) return
    queryPlace.value = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      formattedAddress: place.formatted_address || place.name || query.value.trim(),
    }
    query.value = queryPlace.value.formattedAddress
  })
}

onMounted(async () => {
  await loadGoogleMapsApi()

  map = new window.google.maps.Map(mapContainerRef.value, {
    center: MELBOURNE_CENTER,
    zoom: 13,
    mapId: 'aae9ba2249f23f6f5ac271a0',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  })

  directionsService = new window.google.maps.DirectionsService()
  placesService = new window.google.maps.places.PlacesService(map)
  directionsRenderer = new window.google.maps.DirectionsRenderer({
    map,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#059669', strokeWeight: 5 },
  })

  mapReady.value = true
  await nextTick()
  setupQueryAutocomplete()
  window.google.maps.event.trigger(map, 'resize')
  await locateUser()
})
</script>

<template>
  <main class="page">
    <section class="top-bar">
      <router-link to="/" class="back-link-top" title="Back to Home">
        <span class="back-icon-top">←</span>
      </router-link>
      <div class="search-wrapper">
        <div class="search-row">
          <input
            ref="queryInputRef"
            v-model="query"
            class="search-input"
            type="text"
            placeholder="Enter an address to find nearby counseling rooms"
            @input="onQueryInput"
          />
          <button
            class="search-action-btn"
            type="button"
            :disabled="applyingAddressFilter"
            @click="applyAddressFilter"
          >
            {{ applyingAddressFilter ? 'Filtering...' : 'Filter Nearby' }}
          </button>
        </div>
        <p v-if="addressFilterError" class="search-error">{{ addressFilterError }}</p>
      </div>
      <button class="location-btn" type="button" @click="locateUser">Use My Location</button>
    </section>

    <section class="layout">
      <div class="map-panel">
        <div ref="mapContainerRef" class="map-canvas"></div>
        <div v-if="!mapReady" class="map-mask">Loading map...</div>
        <div class="legend">
          <div class="legend-title">Legend</div>
          <div class="legend-item">
            <span class="dot user-dot"></span>
            <span>Your Location</span>
          </div>
          <div class="legend-item">
            <span class="dot room-dot"></span>
            <span>Counseling Rooms</span>
          </div>
          <div v-if="filterCenter" class="legend-item">
            <span class="dot filter-dot"></span>
            <span>Input Address</span>
          </div>
          <div v-if="selectedRoomId" class="legend-group">
            <div class="legend-item">
              <span class="pin start-pin">S</span>
              <span>Start</span>
            </div>
            <div class="legend-item">
              <span class="pin dest-pin">D</span>
              <span>Destination</span>
            </div>
          </div>
        </div>
      </div>

      <aside class="list-panel">
        <h2>Nearby Counseling Rooms</h2>
        <p class="sub">Based on your current location</p>
        <button v-if="selectedRoom" type="button" class="back-btn" @click="clearSelectedRoom">
          Back to full list
        </button>

        <div v-if="loadingRooms" class="state-tip">Loading nearby rooms...</div>
        <div v-else-if="roomsFetchError" class="state-tip state-tip--error">
          {{ roomsFetchError }}
        </div>
        <div v-else-if="displayedRooms.length === 0" class="state-tip">
          No counseling rooms found.
        </div>

        <button
          v-for="room in displayedRooms"
          :key="room.id"
          type="button"
          :class="['room-card', { active: selectedRoomId === room.id }]"
          @click="selectRoomAndRoute(room)"
        >
          <h3>{{ room.name }}</h3>
          <p class="meta">
            {{ room.distanceText || '--' }} | {{ formatWalkDuration(room.durationText) }}
          </p>
          <p class="origin-line">From: {{ getCurrentLocationLabel() }}</p>
          <span class="details-btn">View Routes</span>
        </button>

        <section v-if="selectedRoom" class="route-builder">
          <h3 class="route-title">Travel Mode</h3>
          <div class="mode-row">
            <button
              v-for="mode in TRAVEL_MODES"
              :key="mode.id"
              type="button"
              :class="['mode-chip', { active: travelMode === mode.id }]"
              @click="selectTravelMode(mode.id)"
            >
              {{ mode.label }}
            </button>
          </div>
          <p v-if="routeSummary" class="estimate-text">Estimate: {{ routeSummary }}</p>
        </section>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.page {
  --nearby-map-height: calc(100vh - 160px);
  max-width: 1400px;
  margin: 0 auto;
  padding: 18px 24px 24px;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    sans-serif;
}

.top-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  align-items: flex-start;
}

.search-wrapper {
  flex: 1;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-link-top {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  text-decoration: none;
  color: #1e293b;
  transition: all 0.2s;
  flex-shrink: 0;
}

.back-link-top:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateX(-2px);
}

.back-icon-top {
  font-size: 24px;
  font-weight: 700;
}

.search-input {
  box-sizing: border-box;
  width: 100%;
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  padding: 11px 12px;
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: #059669;
  box-shadow: 0 0 0 3px #d1fae5;
}

.search-action-btn {
  border: none;
  border-radius: 10px;
  background: #0f766e;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  padding: 0 14px;
  height: 44px;
  flex-shrink: 0;
  white-space: nowrap;
}

.search-action-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.search-error {
  margin: 6px 0 0;
  color: #b91c1c;
  font-size: 12px;
}

.location-btn {
  border: none;
  border-radius: 10px;
  background: #16a34a;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  padding: 0 16px;
  height: 44px;
  flex-shrink: 0;
  white-space: nowrap;
}

.layout {
  display: grid;
  grid-template-columns: 2.2fr 1fr;
  gap: 14px;
  align-items: start;
}

.map-panel {
  position: relative;
  width: 100%;
  height: var(--nearby-map-height);
  min-height: 360px;
  max-height: var(--nearby-map-height);
  background: #dfe8d9;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  overflow: hidden;
}

.map-canvas {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.8);
  color: #374151;
}

.legend {
  position: absolute;
  left: 20px;
  bottom: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.legend-title {
  font-size: 14px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-item > span:last-child {
  font-size: 13px;
  color: #475569;
  font-weight: 500;
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  flex-shrink: 0;
}

.user-dot {
  background: #16a34a;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.room-dot {
  background: #ef4444;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.filter-dot {
  background: #7c3aed;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
}

.legend-group {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

.pin {
  width: 22px;
  height: 22px;
  background: #dc2626;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff !important;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.start-pin,
.dest-pin {
  background: #dc2626;
}

.list-panel {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
  padding: 14px;
  max-height: var(--nearby-map-height);
  overflow-x: hidden;
  overflow-y: auto;
}

h2 {
  margin: 0;
  color: #1f2937;
}

.sub {
  margin: 4px 0 12px;
  color: #6b7280;
  font-size: 13px;
}

.back-btn {
  margin-bottom: 12px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}

.route-summary {
  margin: 0 0 12px;
  color: #065f46;
  font-size: 13px;
  font-weight: 600;
}

.state-tip {
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  padding: 12px;
  color: #6b7280;
}

.state-tip--error {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
}

.room-card {
  width: 100%;
  text-align: left;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #ffffff;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
}

.room-card.active {
  border-color: #059669;
  box-shadow: 0 0 0 2px #d1fae5;
}

h3 {
  margin: 0 0 10px;
  color: #1f2937;
  font-size: 19px;
}

.meta {
  margin: 0 0 8px;
  color: #374151;
}

.origin-line {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 13px;
}

.details-btn {
  display: inline-block;
  width: 100%;
  text-align: center;
  border: 1px solid #059669;
  border-radius: 8px;
  color: #065f46;
  font-weight: 600;
  line-height: 34px;
}

.route-builder {
  margin-top: 8px;
  border-top: 1px solid #e5e7eb;
  padding-top: 14px;
}

.route-title {
  margin: 0 0 10px;
  font-size: 16px;
  color: #1f2937;
}

.mode-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
}

.mode-chip {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #ffffff;
  padding: 8px 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.mode-chip.active {
  background: #16a34a;
  border-color: #16a34a;
  color: #ffffff;
}

.estimate-text {
  margin: 10px 0 0;
  font-size: 16px;
  font-weight: 700;
  color: #166534;
}

@media (max-width: 1200px) {
  .page {
    /* Same idea as MyRoutesView narrow layout: fixed map block, not driven by list length. */
    --nearby-map-height: min(65vh, calc(100vh - 160px));
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .list-panel {
    max-height: none;
    overflow-y: visible;
  }
}

@media (max-width: 900px) {
  .top-bar {
    flex-wrap: wrap;
  }
  .search-wrapper {
    order: 3;
    width: 100%;
    flex: none;
  }
}
</style>
