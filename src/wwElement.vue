<template>
  <div v-if="!content.portalTarget || content.portalTarget === 'admin'" class="spread-geo" :style="{ '--map-h': mapHeightPx }">
    <div v-if="permissionGranted !== true" class="spread-perm-overlay" style="position:absolute;inset:0;z-index:9999;background:var(--spread-cream,#FBFAF8);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;text-align:center;">
      <div v-if="permissionGranted === null" style="width:24px;height:24px;border:3px solid rgba(0,0,0,0.1);border-top-color:var(--spread-accent,#CE6632);border-radius:50%;animation:spread-perm-spin 0.7s linear infinite;"></div>
      <template v-else>
        <span style="font-size:32px;line-height:1;">🔒</span>
        <strong style="font-size:15px;font-weight:700;color:var(--spread-black,#141414);margin:0;">Access denied</strong>
        <span style="font-size:13px;color:var(--spread-mid-grey,#6B7280);">You don't have permission to view this area.</span>
      </template>
    </div>
    <!-- ── Toolbar ────────────────────────────────────── -->
    <div class="spread-geo__toolbar">
      <h2 class="spread-geo__title">Capacity Map</h2>
      <div class="spread-geo__toolbar-controls">
        <!-- AU / International toggle -->
        <div class="spread-geo__toggle-group">
          <button
            class="spread-geo__toggle-btn"
            :class="{ 'spread-geo__toggle-btn--active': activeView === 'au' }"
            @click="switchView('au')"
          >Australia</button>
          <button
            class="spread-geo__toggle-btn"
            :class="{ 'spread-geo__toggle-btn--active': activeView === 'world' }"
            @click="switchView('world')"
          >International</button>
        </div>
        <!-- Cycle selector -->
        <select v-if="cycles.length" v-model="selectedCycleId" class="spread-geo__select" @change="onCycleChange">
          <option v-for="cy in cycles" :key="cy.id" :value="cy.id">{{ cy.name }}{{ cy.is_current ? ' (current)' : '' }}</option>
        </select>
        <!-- Refresh -->
        <button class="spread-geo__btn spread-geo__btn--outline" :disabled="loading" @click="refreshAll">
          <span v-if="loading" class="spread-geo__spinner"></span>
          <span v-else>&#x21BB; Refresh</span>
        </button>
      </div>
    </div>

    <!-- ── Map + Detail split ─────────────────────────── -->
    <div class="spread-geo__body" :class="{ 'spread-geo__body--panel-open': selectedRegion }">
      <!-- Map container -->
      <div class="spread-geo__map-wrap">
        <div ref="mapContainer" class="spread-geo__map"></div>
        <!-- Legend -->
        <div class="spread-geo__legend">
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#16A34A"></span> Open (&lt;50%)</span>
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#D97706"></span> Warning (50-79%)</span>
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#D14343"></span> Critical (80-99%)</span>
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#7F1D1D"></span> Full (100%)</span>
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#6B7280"></span> Closed</span>
          <span class="spread-geo__legend-item"><span class="spread-geo__legend-swatch" style="background:#E5E7EB"></span> No data</span>
        </div>
      </div>

      <!-- Detail panel -->
      <transition name="spread-geo__slide">
        <div v-if="selectedRegion" class="spread-geo__panel">
          <div class="spread-geo__panel-header">
            <h3 class="spread-geo__panel-title">{{ selectedRegion.region_name }}</h3>
            <button class="spread-geo__panel-close" @click="closePanel">&times;</button>
          </div>
          <div class="spread-geo__panel-body">
            <!-- Status badge -->
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Status</span>
              <span
                class="spread-geo__badge"
                :class="'spread-geo__badge--' + (selectedRegion.is_open ? 'open' : 'closed')"
              >{{ selectedRegion.is_open ? 'Open' : 'Closed' }}</span>
            </div>
            <!-- Utilisation -->
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Utilisation</span>
              <span class="spread-geo__panel-value">{{ selectedRegion.utilisation_pct }}%</span>
            </div>
            <div class="spread-geo__bar-bg">
              <div
                class="spread-geo__bar-fill"
                :class="barClass(selectedRegion.utilisation_pct)"
                :style="{ width: Math.min(selectedRegion.utilisation_pct, 100) + '%' }"
              ></div>
            </div>
            <!-- Orders / Cap -->
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Orders / Cap</span>
              <span class="spread-geo__panel-value">{{ selectedRegion.orders_in_cycle }} / {{ selectedRegion.max_orders || '∞' }}</span>
            </div>
            <!-- Reserve -->
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Member Reserve</span>
              <span class="spread-geo__panel-value">{{ selectedRegion.reserve_for_members }}</span>
            </div>
            <!-- State / Country roll-up -->
            <div class="spread-geo__divider"></div>
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">State Status</span>
              <span class="spread-geo__panel-value">{{ selectedRegion.state_status }} ({{ selectedRegion.state_orders }}/{{ selectedRegion.state_max_orders || '∞' }})</span>
            </div>
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Country Status</span>
              <span class="spread-geo__panel-value">{{ selectedRegion.country_status }} ({{ selectedRegion.country_orders }}/{{ selectedRegion.country_max_orders || '∞' }})</span>
            </div>
            <!-- Waitlist -->
            <div v-if="selectedRegionWaitlist > 0" class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Waitlist</span>
              <span class="spread-geo__panel-value spread-geo__panel-value--info">
                {{ selectedRegionWaitlist }} pending
                <button
                  v-if="waitlistEntries.length"
                  class="spread-geo__expand-btn"
                  @click="waitlistExpanded = !waitlistExpanded"
                >{{ waitlistExpanded ? '▲' : '▼' }}</button>
              </span>
            </div>
            <!-- Expanded waitlist entries -->
            <div v-if="waitlistExpanded && waitlistEntries.length" class="spread-geo__waitlist-list">
              <div v-for="entry in waitlistEntries" :key="entry.id" class="spread-geo__waitlist-entry">
                <span class="spread-geo__waitlist-email">{{ entry.email }}</span>
                <span class="spread-geo__waitlist-date">{{ new Date(entry.created_at).toLocaleDateString() }}</span>
              </div>
            </div>
            <!-- Active members -->
            <div class="spread-geo__panel-row">
              <span class="spread-geo__panel-label">Active Members</span>
              <span class="spread-geo__panel-value">{{ regionMemberCount }}</span>
            </div>

            <!-- ── Actions ──────────────────────────── -->
            <div class="spread-geo__divider"></div>
            <!-- Toggle open/close -->
            <button
              class="spread-geo__btn spread-geo__btn--block"
              :class="selectedRegion.is_open ? 'spread-geo__btn--danger' : 'spread-geo__btn--primary'"
              :disabled="actionLoading"
              @click="toggleRegion"
            >
              {{ actionLoading ? 'Saving…' : (selectedRegion.is_open ? 'Close Region' : 'Open Region') }}
            </button>

            <!-- Edit capacity -->
            <div v-if="editMode" class="spread-geo__edit-form">
              <label class="spread-geo__edit-label">
                Max Orders
                <input v-model.number="editMaxOrders" type="number" min="0" class="spread-geo__input" />
              </label>
              <label class="spread-geo__edit-label">
                Reserve for Members
                <input v-model.number="editReserve" type="number" min="0" class="spread-geo__input" />
              </label>
              <div class="spread-geo__edit-actions">
                <button class="spread-geo__btn spread-geo__btn--primary" :disabled="actionLoading" @click="saveCapacity">Save</button>
                <button class="spread-geo__btn spread-geo__btn--outline" @click="editMode = false">Cancel</button>
              </div>
            </div>
            <button v-else class="spread-geo__btn spread-geo__btn--outline spread-geo__btn--block" @click="startEdit">
              Edit Capacity
            </button>
          </div>
        </div>
      </transition>
    </div>

    <!-- Error toast -->
    <transition name="spread-geo__fade">
      <div v-if="errorMsg" class="spread-geo__toast spread-geo__toast--error">
        {{ errorMsg }}
        <button class="spread-geo__toast-close" @click="errorMsg = null">&times;</button>
      </div>
    </transition>

    <!-- Activate region modal -->
    <transition name="spread-geo__fade">
      <div v-if="showActivateModal" class="spread-geo__modal-overlay" @click.self="showActivateModal = false">
        <div class="spread-geo__modal">
          <div class="spread-geo__modal-header">
            <h3 class="spread-geo__modal-title">Activate Region</h3>
            <button class="spread-geo__panel-close" @click="showActivateModal = false">&times;</button>
          </div>
          <div class="spread-geo__modal-body" v-if="activateRegionData">
            <p class="spread-geo__modal-text">
              <strong>{{ activateRegionData.name }}</strong> has no capacity configuration.
              Activate it with default settings?
            </p>
            <label class="spread-geo__edit-label">
              Max Orders
              <input v-model.number="activateRegionData.maxOrders" type="number" min="1" class="spread-geo__input" />
            </label>
            <label class="spread-geo__edit-label">
              Reserve for Members
              <input v-model.number="activateRegionData.reserve" type="number" min="0" class="spread-geo__input" />
            </label>
            <label class="spread-geo__edit-label">
              Reserve Mode
              <select v-model="activateRegionData.reserveMode" class="spread-geo__input">
                <option value="first_come">First Come</option>
                <option value="members_first">Members First</option>
              </select>
            </label>
            <label class="spread-geo__edit-label" style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <input type="checkbox" v-model="activateRegionData.isOpen" />
              Open immediately
            </label>
            <div class="spread-geo__edit-actions" style="margin-top:12px">
              <button class="spread-geo__btn spread-geo__btn--primary" :disabled="actionLoading" @click="activateRegion">
                {{ actionLoading ? 'Activating…' : 'Activate &amp; Open' }}
              </button>
              <button class="spread-geo__btn spread-geo__btn--outline" @click="showActivateModal = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

/* ------------------------------------------------------------------ */
/*  Inline Supabase client (no shared imports — WeWeb requirement)    */
/* ------------------------------------------------------------------ */
function createSpreadClient(url, anonKey, token) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  return {
    async rpc(fnName, params = {}) {
      const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw Object.assign(new Error(e.message || res.statusText), { status: res.status, code: e.code });
      }
      return res.json();
    },
    async edgeFn(fnName, body) {
      const res = await fetch(`${url}/functions/v1/${fnName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw Object.assign(new Error(e.message || res.statusText), { status: res.status, code: e.code });
      }
      return res.json();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const AU_CENTER = [-25.2744, 133.7751];
const AU_ZOOM = 4;
const WORLD_CENTER = [20, 0];
const WORLD_ZOOM = 2;

const ZOOM_TO_LEVEL = [
  { minZoom: 0, maxZoom: 3, level: 0 },   // countries
  { minZoom: 4, maxZoom: 5, level: 1 },   // states
  { minZoom: 6, maxZoom: 8, level: 2 },   // regions (ADM2)
  { minZoom: 9, maxZoom: 12, level: 3 },  // AU postcodes
  { minZoom: 13, maxZoom: 20, level: 2 }, // fall back to regions at very high zoom
];

const DEBOUNCE_MS = 300;

const COLOUR_SCALE = {
  green: '#16A34A',
  amber: '#D97706',
  red: '#D14343',
  darkRed: '#991B1B',
  closed: '#9CA3AF',
  uncapped: '#93C5FD',
  noData: '#E5E7EB',
};

/* ------------------------------------------------------------------ */
/*  Editor mock data                                                  */
/* ------------------------------------------------------------------ */
const MOCK_UTILISATION = [
  { region_id: 'r1', region_name: 'Sydney Metro', state_id: 's1', state_name: 'New South Wales', country_id: 'c1', cycle_id: 'cy1', orders_in_cycle: 42, max_orders: 100, utilisation_pct: 42, is_open: true, reserve_for_members: 10, state_status: 'partial', state_max_orders: 500, state_floor: 300, state_orders: 180, country_status: 'partial', country_max_orders: 2000, country_floor: 1200, country_orders: 890 },
  { region_id: 'r2', region_name: 'Melbourne CBD', state_id: 's2', state_name: 'Victoria', country_id: 'c1', cycle_id: 'cy1', orders_in_cycle: 78, max_orders: 100, utilisation_pct: 78, is_open: true, reserve_for_members: 15, state_status: 'partial', state_max_orders: 400, state_floor: 250, state_orders: 210, country_status: 'partial', country_max_orders: 2000, country_floor: 1200, country_orders: 890 },
  { region_id: 'r3', region_name: 'Brisbane North', state_id: 's3', state_name: 'Queensland', country_id: 'c1', cycle_id: 'cy1', orders_in_cycle: 93, max_orders: 100, utilisation_pct: 93, is_open: true, reserve_for_members: 5, state_status: 'full', state_max_orders: 300, state_floor: 200, state_orders: 280, country_status: 'partial', country_max_orders: 2000, country_floor: 1200, country_orders: 890 },
  { region_id: 'r4', region_name: 'Perth Metro', state_id: 's4', state_name: 'Western Australia', country_id: 'c1', cycle_id: 'cy1', orders_in_cycle: 0, max_orders: 50, utilisation_pct: 0, is_open: false, reserve_for_members: 0, state_status: 'closed', state_max_orders: 0, state_floor: 0, state_orders: 0, country_status: 'partial', country_max_orders: 2000, country_floor: 1200, country_orders: 890 },
];

const MOCK_WAITLIST = [
  { id: 'r1', name: 'Sydney Metro', state_id: 's1', waitlist_count: 23 },
  { id: 'r3', name: 'Brisbane North', state_id: 's3', waitlist_count: 8 },
  { id: 'r4', name: 'Perth Metro', state_id: 's4', waitlist_count: 41 },
];

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content: { type: Object, required: true },
    wwFrontState: { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },
  emits: ['trigger-event', 'update:content'],

  setup(props, { emit }) {
    // ── Leaflet instance management ───────────────────
    let map = null;
    let geoLayer = null;
    let leafletLib = null;
    let moveTimer = null;
    let pollTimer = null;
    let lastBbox = null;
    let lastLevel = null;

    // Cache of fetched GeoJSON layers by level
    const layerCache = {};
    const CACHE_MAX = 20;

    function cacheKey(level, bbox) {
      // Round bbox to 2 decimals for stable keys
      const w = bbox.west.toFixed(2);
      const s = bbox.south.toFixed(2);
      const e = bbox.east.toFixed(2);
      const n = bbox.north.toFixed(2);
      return `${level}:${w},${s},${e},${n}`;
    }

    function cacheGet(key) {
      return layerCache[key] || null;
    }

    function cachePut(key, data) {
      const keys = Object.keys(layerCache);
      if (keys.length >= CACHE_MAX) {
        // Evict oldest entry (first key)
        delete layerCache[keys[0]];
      }
      layerCache[key] = data;
    }

    function cacheInvalidate() {
      for (const k of Object.keys(layerCache)) delete layerCache[k];
    }

    // ── Reactive state ────────────────────────────────
    const loading = ref(false);
    const actionLoading = ref(false);
    const errorMsg = ref(null);
    const activeView = ref(props.content?.defaultView || 'au');
    const selectedRegion = ref(null);
    const editMode = ref(false);
    const editMaxOrders = ref(0);
    const editReserve = ref(0);
    const utilisationData = ref([]);
    const waitlistData = ref([]);
    const cycles = ref([]);
    const selectedCycleId = ref(null);
    const showActivateModal = ref(false);
    const activateRegionData = ref(null);
    const regionMemberCount = ref(0);
    const waitlistExpanded = ref(false);
    const waitlistEntries = ref([]);
    const lastGeoJSON = ref(null); // stores last raw GeoJSON for safe re-render

    // ── Computed ──────────────────────────────────────
    const isEditorMode = computed(() => {
      /* wwEditor:start */
      return !!props.wwEditorState;
      /* wwEditor:end */
      return false; // eslint-disable-line no-unreachable
    });

    const mapHeightPx = computed(() => (props.content?.mapHeight || 600) + 'px');

    const selectedRegionWaitlist = computed(() => {
      if (!selectedRegion.value) return 0;
      const wl = waitlistData.value.find(w => w.id === selectedRegion.value.region_id);
      return wl?.waitlist_count || 0;
    });

    // ── Utilisation lookup by operational_id ──────────
    const utilisationMap = computed(() => {
      const m = {};
      for (const u of utilisationData.value) {
        m[u.region_id] = u;
        // Also index by state_id and country_id for parent-level colouring
        if (u.state_id && !m['state_' + u.state_id]) {
          m['state_' + u.state_id] = {
            status: u.state_status,
            orders: u.state_orders,
            max: u.state_max_orders,
            pct: u.state_max_orders > 0 ? Math.round((u.state_orders / u.state_max_orders) * 100) : 0,
          };
        }
        if (u.country_id && !m['country_' + u.country_id]) {
          m['country_' + u.country_id] = {
            status: u.country_status,
            orders: u.country_orders,
            max: u.country_max_orders,
            pct: u.country_max_orders > 0 ? Math.round((u.country_orders / u.country_max_orders) * 100) : 0,
          };
        }
      }
      return m;
    });

    // ── Client helper ─────────────────────────────────
    function client() {
      return createSpreadClient(
        props.content?.supabaseUrl,
        props.content?.supabaseAnonKey,
        props.content?.accessToken,
      );
    }

    // ── Colour helpers ────────────────────────────────
    function statusColour(pct, isOpen, statusOverride) {
      if (statusOverride === 'closed' || isOpen === false) return COLOUR_SCALE.closed;
      if (pct >= 100) return COLOUR_SCALE.darkRed;
      if (pct >= 80) return COLOUR_SCALE.red;
      if (pct >= 50) return COLOUR_SCALE.amber;
      return COLOUR_SCALE.green;
    }

    function barClass(pct) {
      if (pct >= 100) return 'spread-geo__bar-fill--dark-red';
      if (pct >= 80) return 'spread-geo__bar-fill--red';
      if (pct >= 50) return 'spread-geo__bar-fill--amber';
      return 'spread-geo__bar-fill--green';
    }

    // ── Zoom-to-level mapping ─────────────────────────
    function zoomToLevel(zoom) {
      for (const r of ZOOM_TO_LEVEL) {
        if (zoom >= r.minZoom && zoom <= r.maxZoom) return r.level;
      }
      return 2;
    }

    // ── Map init ──────────────────────────────────────
    async function initMap(containerEl) {
      if (!containerEl) return;

      // Dynamically import Leaflet
      const L = await importLeaflet();
      if (!L) return;
      leafletLib = L;

      const center = activeView.value === 'au' ? AU_CENTER : WORLD_CENTER;
      const zoom = activeView.value === 'au' ? AU_ZOOM : WORLD_ZOOM;

      map = L.map(containerEl, {
        center,
        zoom,
        minZoom: 2,
        maxZoom: 14,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Moveend handler for progressive zoom
      map.on('moveend', onMapMove);

      // Initial load
      await nextTick();
      map.invalidateSize();
      onMapMove();
    }

    async function importLeaflet() {
      try {
        // In WeWeb, Leaflet CSS must be injected into the front document
        const doc = typeof wwLib !== 'undefined' ? wwLib.getFrontDocument() : document;
        if (!doc.getElementById('leaflet-css')) {
          const link = doc.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
          link.crossOrigin = 'anonymous';
          doc.head.appendChild(link);
        }
        // Load Leaflet UMD via script tag (WeWeb webpack cannot handle ESM externals)
        await new Promise((resolve, reject) => {
          const src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          if (doc.querySelector(`script[src="${src}"]`)) { resolve(); return; }
          const script = doc.createElement('script');
          script.src = src;
          script.integrity = 'sha256-20nQCchB9co0/54tZwql2P/O3rDBIfqiNnJfKBmX3B4=';
          script.crossOrigin = 'anonymous';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Leaflet script failed to load'));
          doc.head.appendChild(script);
        });
        const frontWindow = typeof wwLib !== 'undefined' ? wwLib.getFrontWindow() : window;
        return frontWindow.L;
      } catch (err) {
        console.error('Failed to load Leaflet:', err);
        errorMsg.value = 'Failed to load map library';
        return null;
      }
    }

    // ── Map move handler (debounced) ──────────────────
    function onMapMove() {
      if (!map) return;
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => loadGeoLayer(), DEBOUNCE_MS);
    }

    // ── Load GeoJSON layer ────────────────────────────
    async function loadGeoLayer() {
      if (!map || !leafletLib || isEditorMode.value) return;

      const zoom = map.getZoom();
      const level = zoomToLevel(zoom);
      const bounds = map.getBounds();
      const rawBbox = {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      };

      // Skip if same level and bbox hasn't changed significantly
      if (lastLevel === level && lastBbox && bboxDelta(lastBbox, rawBbox) < 0.05) return;

      lastLevel = level;
      lastBbox = rawBbox;

      // Pad bbox by 20% to pre-fetch surrounding tiles
      const bbox = padBbox(rawBbox, 0.2);

      // Check cache first
      const ck = cacheKey(level, bbox);
      const cached = cacheGet(ck);
      if (cached) {
        renderGeoJSON(cached, level);
        return;
      }

      // Simplify tolerance scales with zoom
      const simplify = level === 0 ? 0.05 : level === 1 ? 0.02 : level === 2 ? 0.005 : 0.001;

      try {
        const geojson = await client().edgeFn('geo-boundaries', {
          level,
          bbox,
          simplify,
        });

        cachePut(ck, geojson);
        renderGeoJSON(geojson, level);
      } catch (err) {
        console.error('geo-boundaries error:', err);
        const status = err?.status;
        if (status === 403) {
          showError('Map data: permission denied — ensure logistics.manage_caps role is assigned');
        } else if (status === 401) {
          showError('Map data: authentication error — please refresh the page');
        } else if (status >= 500) {
          showError('Map data API error — try refreshing');
        }
        // Network errors: leave map as-is (no toast, non-actionable)
      }
    }

    function bboxDelta(a, b) {
      return Math.abs(a.west - b.west) + Math.abs(a.south - b.south) +
             Math.abs(a.east - b.east) + Math.abs(a.north - b.north);
    }

    function padBbox(bbox, factor) {
      const dLng = (bbox.east - bbox.west) * factor;
      const dLat = (bbox.north - bbox.south) * factor;
      return {
        west: bbox.west - dLng,
        south: bbox.south - dLat,
        east: bbox.east + dLng,
        north: bbox.north + dLat,
      };
    }

    // ── Render GeoJSON onto map ───────────────────────
    function renderGeoJSON(geojson, level) {
      if (!map || !leafletLib) return;
      const L = leafletLib;

      // Remove existing layer
      if (geoLayer) {
        map.removeLayer(geoLayer);
        geoLayer = null;
      }

      if (!geojson || !geojson.features || !geojson.features.length) return;

      lastGeoJSON.value = geojson; // store raw GeoJSON for safe re-render after data refresh
      geoLayer = L.geoJSON(geojson, {
        style: (feature) => styleFeature(feature, level),
        onEachFeature: (feature, layer) => {
          // Tooltip on hover
          const p = feature.properties;
          const cap = getFeatureCapacity(p, level);
          let tip = `<strong>${p.name}</strong>`;
          if (cap) {
            tip += `<br>${cap.label}: ${cap.pct}%`;
          }
          layer.bindTooltip(tip, { sticky: true, className: 'spread-geo__tooltip' });

          // Click-to-zoom or select
          layer.on('click', () => onFeatureClick(feature, level));

          // Hover highlight
          layer.on('mouseover', () => {
            layer.setStyle({ weight: 2, opacity: 1.0 });
          });
          layer.on('mouseout', () => {
            geoLayer.resetStyle(layer);
          });
        },
      }).addTo(map);
    }

    function styleFeature(feature, level) {
      const p = feature.properties;
      const cap = getFeatureCapacity(p, level);
      const fillColor = cap ? statusColour(cap.pct, cap.isOpen, cap.status) : COLOUR_SCALE.noData;

      // fillOpacity scales with utilisation: 0.4 (healthy) → 0.7 (at capacity)
      const pct = cap ? cap.pct : 0;
      const fo = cap
        ? (cap.status === 'closed' ? 0.5 : 0.4 + (Math.min(pct, 100) / 100) * 0.3)
        : 0.3;

      return {
        color: '#4B162D',
        weight: 1,
        opacity: 0.6,
        fillColor,
        fillOpacity: fo,
      };
    }

    function getFeatureCapacity(props, level) {
      const uMap = utilisationMap.value;
      const opId = props.operational_id;
      if (!opId) return null;

      if (level === 2 || level === 3) {
        // Region level (2) and postcode level (3) share the same operational_id space
        const u = uMap[opId];
        if (!u) return null;
        return {
          pct: u.utilisation_pct || 0,
          isOpen: u.is_open,
          status: u.is_open ? null : 'closed',
          label: 'Utilisation',
        };
      }
      if (level === 1) {
        // State level
        const u = uMap['state_' + opId];
        if (!u) return null;
        return { pct: u.pct, isOpen: u.status !== 'closed', status: u.status, label: 'State' };
      }
      if (level === 0) {
        // Country level
        const u = uMap['country_' + opId];
        if (!u) return null;
        return { pct: u.pct, isOpen: u.status !== 'closed', status: u.status, label: 'Country' };
      }
      return null;
    }

    // ── Feature click handler ─────────────────────────
    function onFeatureClick(feature, level) {
      if (!map) return;
      const p = feature.properties;

      // At country/state level → zoom in
      if (level === 0 || level === 1) {
        const L = leafletLib;
        if (feature.geometry) {
          const tempLayer = L.geoJSON(feature);
          map.fitBounds(tempLayer.getBounds(), { padding: [40, 40], maxZoom: level === 0 ? 5 : 7 });
          tempLayer.remove();
        }
        return;
      }

      // At region level → select and show panel
      if (level === 2 && p.operational_id) {
        const u = utilisationMap.value[p.operational_id];
        if (u) {
          selectedRegion.value = { ...u };
          editMode.value = false;
          waitlistExpanded.value = false;
          waitlistEntries.value = [];
          regionMemberCount.value = 0;
          // Load supplementary data
          loadRegionDetails(u.region_id);
          emit('trigger-event', {
            name: 'region:selected',
            event: {
              region_id: u.region_id,
              region_name: u.region_name,
              state_name: u.state_name,
              is_open: u.is_open,
              utilisation_pct: u.utilisation_pct,
            },
          });
        } else {
          // Unconfigured region — offer to activate
          activateRegionData.value = {
            id: p.operational_id,
            name: p.name || 'Unknown region',
            maxOrders: 50,
            reserve: 0,
            reserveMode: 'first_come',
            isOpen: true,
          };
          showActivateModal.value = true;
        }
      }
    }

    // ── Panel actions ─────────────────────────────────
    function closePanel() {
      selectedRegion.value = null;
      editMode.value = false;
    }

    function startEdit() {
      if (!selectedRegion.value) return;
      editMaxOrders.value = selectedRegion.value.max_orders || 0;
      editReserve.value = selectedRegion.value.reserve_for_members || 0;
      editMode.value = true;
    }

    async function toggleRegion() {
      if (!selectedRegion.value || actionLoading.value) return;
      actionLoading.value = true;
      const r = selectedRegion.value;
      const newOpen = !r.is_open;
      try {
        await client().rpc('update_region_capacity_admin', {
          p_region_id: r.region_id,
          p_max_orders: r.max_orders || 0,
          p_reserve_for_members: r.reserve_for_members || 0,
          p_is_open: newOpen,
        });
        selectedRegion.value = { ...r, is_open: newOpen };
        emit('trigger-event', {
          name: 'region:toggled',
          event: { region_id: r.region_id, is_open: newOpen },
        });
        await refreshCapacityData();
        // Re-colour the map
        if (lastGeoJSON.value && lastLevel !== null) {
          renderGeoJSON(lastGeoJSON.value, lastLevel);
        }
      } catch (err) {
        showError(err.message || 'Failed to toggle region');
      } finally {
        actionLoading.value = false;
      }
    }

    async function saveCapacity() {
      if (!selectedRegion.value || actionLoading.value) return;
      actionLoading.value = true;
      const r = selectedRegion.value;
      try {
        await client().rpc('update_region_capacity_admin', {
          p_region_id: r.region_id,
          p_max_orders: editMaxOrders.value,
          p_reserve_for_members: editReserve.value,
          p_is_open: r.is_open,
        });
        selectedRegion.value = {
          ...r,
          max_orders: editMaxOrders.value,
          reserve_for_members: editReserve.value,
        };
        editMode.value = false;
        emit('trigger-event', {
          name: 'capacity:updated',
          event: { region_id: r.region_id, success: true, message: 'Capacity updated' },
        });
        await refreshCapacityData();
      } catch (err) {
        showError(err.message || 'Failed to update capacity');
      } finally {
        actionLoading.value = false;
      }
    }

    // ── Activate unconfigured region ─────────────────
    async function activateRegion() {
      if (!activateRegionData.value || actionLoading.value) return;
      actionLoading.value = true;
      const r = activateRegionData.value;
      try {
        await client().rpc('update_region_capacity_admin', {
          p_region_id: r.id,
          p_max_orders: r.maxOrders || 50,
          p_reserve_for_members: r.reserve || 0,
          p_is_open: r.isOpen !== undefined ? r.isOpen : true,
        });
        showActivateModal.value = false;
        activateRegionData.value = null;
        emit('trigger-event', {
          name: 'region:activated',
          event: { region_id: r.id, region_name: r.name },
        });
        cacheInvalidate();
        await refreshCapacityData();
        loadGeoLayer();
      } catch (err) {
        showError(err.message || 'Failed to activate region');
      } finally {
        actionLoading.value = false;
      }
    }

    // ── Load supplementary details for selected region ─
    async function loadRegionDetails(regionId) {
      try {
        const [memberCount, entries] = await Promise.allSettled([
          client().rpc('get_region_member_count', { p_region_id: regionId }),
          client().rpc('get_waitlist_entries', { p_region_id: regionId }),
        ]);
        if (memberCount.status === 'fulfilled') {
          regionMemberCount.value = memberCount.value || 0;
        }
        if (entries.status === 'fulfilled') {
          waitlistEntries.value = Array.isArray(entries.value) ? entries.value : [];
        }
      } catch (err) {
        console.error('loadRegionDetails error:', err);
      }
    }

    // ── View switching ────────────────────────────────
    function switchView(view) {
      activeView.value = view;
      cacheInvalidate();
      if (!map) return;
      if (view === 'au') {
        map.setView(AU_CENTER, AU_ZOOM);
      } else {
        map.setView(WORLD_CENTER, WORLD_ZOOM);
      }
    }

    function onCycleChange() {
      refreshCapacityData();
    }

    // ── Data loading ──────────────────────────────────
    async function refreshAll() {
      loading.value = true;
      try {
        cacheInvalidate();
        await Promise.allSettled([
          refreshCapacityData(),
          loadWaitlistData(),
          loadCycles(),
        ]);
        // Reload geo layer with fresh data
        loadGeoLayer();
      } catch (err) {
        showError(err.message || 'Refresh failed');
      } finally {
        loading.value = false;
      }
    }

    async function refreshCapacityData() {
      if (isEditorMode.value) {
        utilisationData.value = MOCK_UTILISATION;
        return;
      }
      try {
        const params = {};
        if (selectedCycleId.value) params.p_cycle_id = selectedCycleId.value;
        const data = await client().rpc('get_capacity_utilisation', params);
        utilisationData.value = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('get_capacity_utilisation error:', err);
      }
    }

    async function loadWaitlistData() {
      if (isEditorMode.value) {
        waitlistData.value = MOCK_WAITLIST;
        return;
      }
      try {
        const data = await client().rpc('get_geo_waitlist_counts', { p_level: 'region' });
        waitlistData.value = Array.isArray(data) ? data : [];
      } catch (err) {
        console.error('get_geo_waitlist_counts error:', err);
      }
    }

    async function loadCycles() {
      if (isEditorMode.value) {
        cycles.value = [
          { id: 'cy1', name: 'Week 11', is_current: true },
          { id: 'cy2', name: 'Week 12', is_current: false },
        ];
        selectedCycleId.value = 'cy1';
        return;
      }
      try {
        const data = await client().rpc('list_recent_cycles', { p_limit: 5 });
        if (Array.isArray(data) && data.length) {
          cycles.value = data;
          // Auto-select the current cycle (first one with is_current=true)
          const current = data.find(c => c.is_current);
          selectedCycleId.value = current ? current.id : data[0].id;
        } else {
          // Fallback to get_active_cycle for backwards compat
          const single = await client().rpc('get_active_cycle', {});
          if (single) {
            cycles.value = [{ ...single, is_current: true }];
            selectedCycleId.value = single.id;
          }
        }
      } catch (err) {
        console.error('loadCycles error:', err);
        // Fallback to get_active_cycle
        try {
          const single = await client().rpc('get_active_cycle', {});
          if (single) {
            cycles.value = [{ ...single, is_current: true }];
            selectedCycleId.value = single.id;
          }
        } catch (err2) {
          console.error('get_active_cycle fallback error:', err2);
        }
      }
    }

    // ── Error helper ──────────────────────────────────
    function showError(msg) {
      errorMsg.value = msg;
      emit('trigger-event', { name: 'error', event: { message: msg, code: '' } });
      setTimeout(() => { errorMsg.value = null; }, 5000);
    }

    // ── Polling ───────────────────────────────────────
    function startPolling() {
      const interval = (props.content?.pollingInterval || 60) * 1000;
      pollTimer = setInterval(() => {
        refreshCapacityData();
      }, interval);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    // ── Lifecycle ─────────────────────────────────────
    const mapContainer = ref(null);

    onMounted(async () => {
      if (isEditorMode.value) {
        utilisationData.value = MOCK_UTILISATION;
        waitlistData.value = MOCK_WAITLIST;
        cycles.value = [{ id: 'cy1', name: 'Week 11' }, { id: 'cy2', name: 'Week 12' }];
        selectedCycleId.value = 'cy1';
        return;
      }

      await nextTick();
      await initMap(mapContainer.value);
      await refreshAll();
      startPolling();
    });

    onBeforeUnmount(() => {
      stopPolling();
      clearTimeout(moveTimer);
      if (map) {
        map.off('moveend', onMapMove);
        map.remove();
        map = null;
      }
    });

    // ── Watch for refreshTrigger changes ──────────────
    watch(() => props.content?.refreshTrigger, () => {
      refreshAll();
    });

    watch(() => props.content?.pollingInterval, () => {
      stopPolling();
      startPolling();
    });

    // ── Invalidate map size when detail panel opens / closes ─────────────────
    // The CSS grid shifts map width when the panel slides in; Leaflet must be
    // notified to recalculate tile positions, otherwise a grey gap appears.
    watch(selectedRegion, () => {
      if (!map) return;
      nextTick(() => map.invalidateSize());
    });

    return {
      permissionGranted,
      mapContainer,
      loading,
      actionLoading,
      errorMsg,
      activeView,
      selectedRegion,
      editMode,
      editMaxOrders,
      editReserve,
      utilisationData,
      waitlistData,
      cycles,
      selectedCycleId,
      mapHeightPx,
      selectedRegionWaitlist,
      showActivateModal,
      activateRegionData,
      regionMemberCount,
      waitlistExpanded,
      waitlistEntries,
      barClass,
      switchView,
      onCycleChange,
      refreshAll,
      closePanel,
      startEdit,
      toggleRegion,
      saveCapacity,
      activateRegion,
    };
  },
};
</script>

<style scoped>
/* ── Design tokens (from Spread.co design system) ───────────── */
:root {
  --spread-primary: #4B162D;
  --spread-accent: #CE6632;
  --spread-accent-hover: #B5572B;
  --spread-black: #141414;
  --spread-dark: #2B2B2B;
  --spread-mid: #4B5563;
  --spread-light: #6B7280;
  --spread-white: #FFFFFF;
  --spread-cream: #FBFAF8;
  --spread-border: #F3EADF;
  --spread-border-outer: #EFE7DE;
  --spread-error: #D14343;
  --spread-error-bg: #FEF2F2;
  --spread-success: #16A34A;
  --spread-warning: #D97706;
  --spread-info: #2563EB;
  --spread-radius: 12px;
  --spread-radius-lg: 16px;
  --spread-font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* ── Root ───────────────────────────────────────────────────── */
.spread-geo {
  width: 100%;
  box-sizing: border-box;
  font-family: var(--spread-font);
  color: var(--spread-black);
  position: relative;
  max-width: 1440px;
  margin-inline: auto;
}

.spread-geo *, .spread-geo *::before, .spread-geo *::after {
  box-sizing: border-box;
}

/* ── Toolbar ────────────────────────────────────────────────── */
.spread-geo__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: var(--spread-white);
  border: 1px solid var(--spread-border-outer);
  border-radius: var(--spread-radius-lg) var(--spread-radius-lg) 0 0;
}

.spread-geo__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--spread-black);
  margin: 0;
}

.spread-geo__toolbar-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* ── Toggle group ───────────────────────────────────────────── */
.spread-geo__toggle-group {
  display: flex;
  border: 1px solid var(--spread-border);
  border-radius: var(--spread-radius);
  overflow: hidden;
}

.spread-geo__toggle-btn {
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  background: var(--spread-white);
  color: var(--spread-mid);
  cursor: pointer;
  transition: all 0.15s ease;
}

.spread-geo__toggle-btn--active {
  background: var(--spread-primary);
  color: var(--spread-white);
}

/* ── Select ─────────────────────────────────────────────────── */
.spread-geo__select {
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--spread-border);
  border-radius: var(--spread-radius);
  background: var(--spread-white);
  color: var(--spread-dark);
  font-family: var(--spread-font);
}

/* ── Buttons ────────────────────────────────────────────────── */
.spread-geo__btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1px;
  border-radius: var(--spread-radius);
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  font-family: var(--spread-font);
}

.spread-geo__btn--primary {
  background: var(--spread-accent);
  color: var(--spread-white);
}
.spread-geo__btn--primary:hover { background: var(--spread-accent-hover); }

.spread-geo__btn--outline {
  background: var(--spread-white);
  color: var(--spread-accent);
  border: 1px solid var(--spread-accent);
}
.spread-geo__btn--outline:hover { background: #FFF7ED; }

.spread-geo__btn--danger {
  background: var(--spread-error);
  color: var(--spread-white);
}
.spread-geo__btn--danger:hover { background: #B93B3B; }

.spread-geo__btn--block { width: 100%; }

.spread-geo__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Body (map + panel layout) ──────────────────────────────── */
.spread-geo__body {
  display: flex;
  border: 1px solid var(--spread-border-outer);
  border-top: none;
  border-radius: 0 0 var(--spread-radius-lg) var(--spread-radius-lg);
  overflow: hidden;
  position: relative;
}

.spread-geo__map-wrap {
  flex: 1;
  position: relative;
  min-height: var(--map-h, 600px);
}

.spread-geo__map {
  width: 100%;
  height: 100%;
  min-height: var(--map-h, 600px);
  z-index: 0;
}

/* ── Legend ──────────────────────────────────────────────────── */
.spread-geo__legend {
  position: absolute;
  bottom: 20px;
  left: 12px;
  z-index: 400;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--spread-border);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--spread-dark);
}

.spread-geo__legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spread-geo__legend-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

/* ── Detail panel ───────────────────────────────────────────── */
.spread-geo__panel {
  width: 340px;
  flex-shrink: 0;
  background: var(--spread-white);
  border-left: 1px solid var(--spread-border);
  overflow-y: auto;
  max-height: var(--map-h, 600px);
}

.spread-geo__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--spread-border);
}

.spread-geo__panel-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--spread-black);
  margin: 0;
}

.spread-geo__panel-close {
  background: none;
  border: none;
  font-size: 22px;
  color: var(--spread-light);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.spread-geo__panel-close:hover { color: var(--spread-error); }

.spread-geo__panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.spread-geo__panel-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.spread-geo__panel-label {
  color: var(--spread-mid);
  font-weight: 400;
}

.spread-geo__panel-value {
  font-weight: 600;
  color: var(--spread-black);
}

.spread-geo__panel-value--info {
  color: var(--spread-info);
}

/* ── Waitlist expansion ─────────────────────────────────────── */
.spread-geo__expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  color: var(--spread-info);
  padding: 0 4px;
  vertical-align: middle;
}

.spread-geo__waitlist-list {
  background: var(--spread-cream);
  border: 1px solid var(--spread-border);
  border-radius: 8px;
  padding: 8px;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spread-geo__waitlist-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 4px;
}

.spread-geo__waitlist-entry:nth-child(odd) {
  background: rgba(0, 0, 0, 0.02);
}

.spread-geo__waitlist-email {
  color: var(--spread-dark);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.spread-geo__waitlist-date {
  color: var(--spread-light);
  font-size: 11px;
  flex-shrink: 0;
}

/* ── Badge ──────────────────────────────────────────────────── */
.spread-geo__badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.spread-geo__badge--open {
  background: #DCFCE7;
  color: var(--spread-success);
}

.spread-geo__badge--closed {
  background: #FEF2F2;
  color: var(--spread-error);
}

/* ── Bar ────────────────────────────────────────────────────── */
.spread-geo__bar-bg {
  width: 100%;
  height: 8px;
  background: #F3F4F6;
  border-radius: 4px;
  overflow: hidden;
}

.spread-geo__bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.spread-geo__bar-fill--green { background: var(--spread-success); }
.spread-geo__bar-fill--amber { background: var(--spread-warning); }
.spread-geo__bar-fill--red { background: var(--spread-error); }
.spread-geo__bar-fill--dark-red { background: #7F1D1D; }

/* ── Divider ────────────────────────────────────────────────── */
.spread-geo__divider {
  height: 1px;
  background: var(--spread-border);
  margin: 6px 0;
}

/* ── Edit form ──────────────────────────────────────────────── */
.spread-geo__edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--spread-cream);
  border: 1px solid var(--spread-border);
  border-radius: var(--spread-radius);
  padding: 14px;
}

.spread-geo__edit-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--spread-dark);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spread-geo__input {
  padding: 8px 10px;
  border: 1px solid var(--spread-border);
  border-radius: 8px;
  font-size: 13px;
  font-family: var(--spread-font);
  background: var(--spread-white);
  color: var(--spread-black);
  width: 100%;
}

.spread-geo__input:focus {
  outline: none;
  border-color: var(--spread-accent);
  box-shadow: 0 0 0 2px rgba(206, 102, 50, 0.15);
}

.spread-geo__edit-actions {
  display: flex;
  gap: 8px;
}

/* ── Toast ──────────────────────────────────────────────────── */
.spread-geo__toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 10px 20px;
  border-radius: var(--spread-radius);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.spread-geo__toast--error {
  background: var(--spread-error);
  color: var(--spread-white);
}

.spread-geo__toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

/* ── Activate Region Modal ──────────────────────────────────── */
.spread-geo__modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spread-geo__modal {
  background: var(--spread-white);
  border-radius: var(--spread-radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 420px;
  overflow: hidden;
}

.spread-geo__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--spread-border);
}

.spread-geo__modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--spread-black);
  margin: 0;
}

.spread-geo__modal-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spread-geo__modal-text {
  font-size: 13px;
  color: var(--spread-mid);
  margin: 0;
  line-height: 1.5;
}

/* ── Spinner ────────────────────────────────────────────────── */
.spread-geo__spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--spread-border);
  border-top-color: var(--spread-accent);
  border-radius: 50%;
  animation: spread-geo-spin 0.6s linear infinite;
}

@keyframes spread-geo-spin {
  to { transform: rotate(360deg); }
}

/* ── Tooltip override for Leaflet ───────────────────────────── */
:deep(.spread-geo__tooltip) {
  font-family: var(--spread-font);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--spread-border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* ── Transitions ────────────────────────────────────────────── */
.spread-geo__slide-enter-active,
.spread-geo__slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.spread-geo__slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.spread-geo__slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.spread-geo__fade-enter-active,
.spread-geo__fade-leave-active {
  transition: opacity 0.3s ease;
}
.spread-geo__fade-enter-from,
.spread-geo__fade-leave-to {
  opacity: 0;
}

/* ── Responsive ─────────────────────────────────────────────── */

/* Mobile: panel as bottom sheet */
@media (max-width: 767px) {
  .spread-geo__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .spread-geo__body {
    flex-direction: column;
  }

  .spread-geo__panel {
    width: 100%;
    max-height: 50vh;
    border-left: none;
    border-top: 1px solid var(--spread-border);
  }

  .spread-geo__slide-enter-from {
    transform: translateY(100%);
  }
  .spread-geo__slide-leave-to {
    transform: translateY(100%);
  }

  .spread-geo__legend {
    bottom: 8px;
    left: 8px;
    font-size: 11px;
    padding: 6px 8px;
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .spread-geo__panel {
    width: 300px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .spread-geo__panel {
    width: 340px;
  }
}

/* Large desktop */
@media (min-width: 1440px) {
  .spread-geo__panel {
    width: 380px;
  }
}

/* Wide desktop (1280-1439) */
@media (min-width: 1280px) and (max-width: 1439px) {
  .spread-geo__panel {
    width: 360px;
  }
}

/* Small mobile (≤480px) */
@media (max-width: 480px) {
  .spread-geo__toolbar {
    padding: 6px 8px;
    gap: 6px;
  }
  .spread-geo__panel {
    max-height: 45vh;
  }
  .spread-geo__panel-title {
    font-size: 15px;
  }
  .spread-geo__stat-value {
    font-size: 14px;
  }
}

/* Narrow mobile (≤385px) */
@media (max-width: 385px) {
  .spread-geo__toggle-btn {
    padding: 4px 8px;
    font-size: 11px;
  }
  .spread-geo__panel {
    max-height: 40vh;
    padding: 10px;
  }
  .spread-geo__modal {
    width: 95%;
    padding: 12px;
  }
  .spread-geo__btn {
    font-size: 12px;
    padding: 6px 10px;
  }
}

/* Minimum mobile (≤320px) */
@media (max-width: 320px) {
  .spread-geo__toolbar {
    padding: 4px 6px;
    font-size: 11px;
  }
  .spread-geo__panel {
    max-height: 35vh;
    padding: 8px;
  }
  .spread-geo__legend {
    font-size: 10px;
    padding: 4px 6px;
  }
}
@media (min-width: 480px) {
  .spread-geo__toolbar { gap: 10px; }
}
@keyframes spread-perm-spin { to { transform: rotate(360deg); } }
</style>
