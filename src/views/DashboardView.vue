<template>
  <div class="dashboard">
    <div class="dashboard-inner">
      <div class="page-tag">
        <span class="page-tag-dot" aria-hidden="true" />
        COMMUNITY WELLBEING
      </div>
      <h1 class="page-title">Community Wellbeing Snapshot</h1>
      <p class="page-subtitle page-subtitle--singleline">
        A look at how older Melburnians are doing — based on public community research.
      </p>
      <div class="meta-row">
        <span class="meta-pill">Updated · April 2026</span>
        <span class="meta-pill">Melbourne, 60+ community</span>
        <span class="meta-pill">Public research only</span>
      </div>

      <section class="section data-lens" aria-labelledby="data-lens-heading">
        <p class="section-kicker">DATA LENS</p>
        <h2 id="data-lens-heading" class="section-title">
          How Melbourne's older community is doing
        </h2>
        <p class="section-lead section-lead--singleline">
          Snapshot indicators drawn from community wellbeing research — useful context, not personal advice.
        </p>

        <div class="cards-grid">
          <article class="card chart-card">
            <h3 class="card-title">1 in 3 are navigating a quieter chapter</h3>
            <div class="donut-row">
              <div class="donut-wrap" aria-hidden="true">
                <svg class="donut-svg" viewBox="0 0 120 120">
                  <circle
                    class="donut-track"
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke-width="18"
                  />
                  <circle
                    class="donut-value"
                    cx="60"
                    cy="60"
                    r="44"
                    fill="none"
                    stroke-width="18"
                    :stroke-dasharray="donutDash"
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div class="donut-center">
                  <span class="donut-pct">36%</span>
                  <span class="donut-label">SIMILAR LIFE TRANSITIONS</span>
                </div>
              </div>
              <ul class="donut-legend">
                <li class="legend-item legend-item--on">
                  <span class="legend-swatch" />
                  Navigating similar life transitions (36%)
                </li>
                <li class="legend-item legend-item--off">
                  <span class="legend-swatch" />
                  Not currently reporting this (64%)
                </li>
              </ul>
            </div>
            <p class="card-foot">
              Across Melbourne, about one in three older residents describe fewer everyday social
              contacts.
            </p>
          </article>

          <article class="card chart-card">
            <h3 class="card-title">Wellbeing patterns among older Melburnians</h3>
            <div class="bar-chart" role="img" aria-label="Three wellbeing percentages: 21, 23, 29">
              <div class="bar-col">
                <div class="bar-track">
                  <div class="bar bar--a" style="height: 72.41%" />
                </div>
                <span class="bar-pct">21%</span>
                <span class="bar-caption">Feeling uneasy in social settings</span>
              </div>
              <div class="bar-col">
                <div class="bar-track">
                  <div class="bar bar--b" style="height: 79.31%" />
                </div>
                <span class="bar-pct">23%</span>
                <span class="bar-caption">Feeling persistently low</span>
              </div>
              <div class="bar-col">
                <div class="bar-track">
                  <div class="bar bar--c" style="height: 100%" />
                </div>
                <span class="bar-pct">29%</span>
                <span class="bar-caption">General sense of low wellbeing</span>
              </div>
            </div>
            <p class="card-foot">
              These patterns are common across the community and often shift with everyday
              connection.
            </p>
          </article>
        </div>

        <div class="sources-bar">
          <span class="sources-icon" aria-hidden="true">&#128218;</span>
          <span>
            Sources: public health and community surveys (illustrative figures for community
            awareness).
          </span>
        </div>
      </section>

      <section class="section life-lens" aria-labelledby="life-lens-heading">
        <p class="section-kicker">LIFE LENS</p>
        <h2 id="life-lens-heading" class="section-title">
          What long periods of quiet can look like
        </h2>
        <p class="section-lead section-lead--life">
          Everyone's experience is different. These are common themes people describe —
          not&nbsp;a&nbsp;checklist,&nbsp;and&nbsp;not&nbsp;a&nbsp;diagnosis.
        </p>

        <div class="life-cards">
          <article class="life-card">
            <div class="life-card-top">
              <div class="life-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3c-2 3-4 5.5-4 9a4 4 0 108 0c0-3.5-2-6-4-9z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M9 18h6"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <span class="life-label">01 — COGNITIVE</span>
            </div>
            <h3 class="life-title">Memory &amp; focus</h3>
            <p class="life-text">
              Days with less conversation can feel mentally “foggy”. Names, plans, and small details
              may take a little longer to recall — often improved by gentle routines and social
              rhythm.
            </p>
          </article>

          <article class="life-card">
            <div class="life-card-top">
              <div class="life-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6" />
                  <path
                    d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <span class="life-label">02 — EMOTIONAL</span>
            </div>
            <h3 class="life-title">Mood &amp; energy</h3>
            <p class="life-text">
              Low mood can arrive gradually — less interest in hobbies, heavier mornings, or feeling
              “flat” for longer stretches. Connection and sunlight help many people feel steadier
              again.
            </p>
          </article>

          <article class="life-card">
            <div class="life-card-top">
              <div class="life-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 11a4 4 0 118 0v3H8v-3z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <span class="life-label">03 — SOCIAL</span>
            </div>
            <h3 class="life-title">Belonging &amp; confidence</h3>
            <p class="life-text">
              Social worlds can shrink quietly. Invitations feel heavier, outings feel tiring, and
              it becomes easier to stay home — even when part of you still wants company.
            </p>
          </article>
        </div>
      </section>

      <div class="cta-bar">
        <div class="cta-copy">
          <p class="cta-text">Recognising these shifts is a first step toward staying connected.</p>
          <p class="cta-hint">
            <router-link to="/" class="cta-home-link">Go to Home</router-link>
            to plan walks, find nearby support, and explore the rest of the site.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const r = 44
const c = 2 * Math.PI * r
const pct = 0.36
const donutDash = computed(() => `${c * pct} ${c}`)
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');

.dashboard {
  --bg: #f9f8f3;
  --green-dark: #2d6a4f;
  --green-mid: #52b788;
  --green-light: #d8f3dc;
  --text: #1f2937;
  --muted: #6b7280;
  --line: #e5e7eb;

  background: var(--bg);
  min-height: calc(100vh - 60px);
  padding: 40px 24px 56px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--text);
}

.dashboard-inner {
  max-width: 1040px;
  margin: 0 auto;
}

.page-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--green-dark);
  background: var(--green-light);
  padding: 8px 14px;
  border-radius: 999px;
  margin-bottom: 18px;
}

.page-tag-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green-mid);
}

.page-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 12px;
  color: #111827;
}

.page-subtitle {
  margin: 0 0 20px;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--muted);
  max-width: 640px;
}

.page-subtitle.page-subtitle--singleline {
  max-width: 100%;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 48px;
}

.meta-pill {
  font-size: 13px;
  color: var(--muted);
  background: #fff;
  border: 1px solid var(--line);
  padding: 6px 12px;
  border-radius: 999px;
}

.section {
  margin-bottom: 48px;
}

.section-kicker {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--green-dark);
}

.section-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.5rem, 2.8vw, 1.85rem);
  font-weight: 700;
  margin: 0 0 10px;
  color: #111827;
}

.section-lead {
  margin: 0 0 28px;
  font-size: 0.98rem;
  line-height: 1.55;
  color: var(--muted);
  max-width: 720px;
}

.section-lead.section-lead--life {
  max-width: 100%;
}

@media (min-width: 640px) {
  .page-subtitle--singleline {
    white-space: nowrap;
    font-size: clamp(0.68rem, 0.35rem + 1.12vw, 1.05rem);
  }

  .section-lead--singleline {
    white-space: nowrap;
    font-size: clamp(0.62rem, 0.30rem + 1.08vw, 0.98rem);
  }

  .section-lead--life {
    white-space: nowrap;
    font-size: clamp(0.65rem, 0.32rem + 1.15vw, 0.98rem);
  }
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

@media (min-width: 900px) {
  .cards-grid {
    grid-template-columns: 1fr 1fr;
    align-items: stretch;
  }
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0 0 20px;
  line-height: 1.35;
}

.donut-row {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}

@media (min-width: 520px) {
  .donut-row {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
  }
}

.donut-wrap {
  position: relative;
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}

.donut-svg {
  width: 100%;
  height: 100%;
}

.donut-track {
  stroke: #e5e7eb;
}

.donut-value {
  stroke: var(--green-dark);
  stroke-linecap: butt;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 18px;
  pointer-events: none;
}

.donut-pct {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--green-dark);
  line-height: 1.1;
}

.donut-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-top: 4px;
}

.donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 320px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #374151;
}

.legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-item--on .legend-swatch {
  background: var(--green-dark);
}

.legend-item--off .legend-swatch {
  background: #d1d5db;
}

.card-foot {
  margin: 20px 0 0;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--muted);
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0 0;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.bar-track {
  width: 100%;
  max-width: 72px;
  height: 160px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 100%;
  border-radius: 10px 10px 4px 4px;
  min-height: 40px;
}

.bar--a {
  background: linear-gradient(180deg, #6bc49a 0%, var(--green-mid) 100%);
}

.bar--b {
  background: linear-gradient(180deg, #5fbf92 0%, #3d9e6c 100%);
}

.bar--c {
  background: linear-gradient(180deg, var(--green-mid) 0%, var(--green-dark) 100%);
}

.bar-pct {
  font-weight: 700;
  font-size: 1rem;
  color: var(--green-dark);
}

.bar-caption {
  font-size: 12px;
  line-height: 1.35;
  color: var(--muted);
}

.sources-bar {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--muted);
  background: #f3f4f6;
  border-radius: 10px;
  padding: 12px 16px;
  border: 1px solid var(--line);
}

.sources-icon {
  font-size: 16px;
  line-height: 1;
}

.life-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.life-card {
  background: #fff;
  border-radius: 12px;
  padding: 22px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.life-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.life-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--green-light);
  color: var(--green-dark);
  display: flex;
  align-items: center;
  justify-content: center;
}

.life-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--green-mid);
}

.life-title {
  margin: 0 0 10px;
  font-size: 1.1rem;
  font-weight: 700;
}

.life-text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
  color: var(--muted);
}

.cta-bar {
  margin-top: 8px;
  background: var(--green-dark);
  color: #fff;
  border-radius: 12px;
  padding: 20px 24px;
}

.cta-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cta-text {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
  font-weight: 500;
}

.cta-hint {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.92);
}

.cta-home-link {
  color: #d8f3dc;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cta-home-link:hover {
  color: #fff;
}
</style>
