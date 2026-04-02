<template>
  <div class="home-wrapper">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="glass-panel main-intro">
        <h1 class="headline">
          <span class="text-dark">Embrace Community</span><br />
          <span class="text-orange">Right Here in Melbourne.</span>
        </h1>
        <p class="description">
          Growing older shouldn't mean feeling alone. We help Melbourne's seniors over 60 discover
          local activities, find companionship, and access mental support resources. Join a caring
          community and add more joy to your everyday life.
        </p>
        <div class="scroll-indicator">
          <span class="chevron"></span>
          <p>Explore Our Services</p>
        </div>
      </div>
    </section>

    <!-- Feature Sections -->
    <div class="features-container">
      <!-- Section 1: Customized Routes -->
      <section id="custom-routes" class="feature-section routes-bg">
        <div class="feature-card">
          <div class="badge">Travel with Confidence</div>
          <h2 class="feature-title">Customized Routes</h2>
          <p class="feature-description">
            Plan a journey that fits your needs perfectly. Whether you prefer a quiet walk with more shade, 
            or need to find public toilets and rest benches along the way, our smart routing tool helps 
            you navigate Melbourne with comfort and confidence. 
          </p>
          <ul class="feature-list">
            <li>🌲 <strong>Shade Optimization:</strong> Choose routes with more tree canopy for a cooler walk.</li>
            <li>🚻 <strong>Accessibility First:</strong> Locate public toilets and rest benches on your path.</li>
            <li>🚶 <strong>Your Pace:</strong> Select from Walking, Cycling, or Transit modes.</li>
          </ul>
          <router-link to="/my-routes" class="btn-solid btn-primary btn-large">
            Plan Your Route Now
          </router-link>
        </div>
      </section>

      <!-- Section 2: Mental Support -->
      <section id="mental-support" class="feature-section mental-bg">
        <div class="feature-card">
          <div class="badge">You Are Not Alone</div>
          <h2 class="feature-title">Mental Health Support</h2>
          <p class="feature-description">
            You're never alone in Melbourne. Easily locate nearby mental health counseling centers 
            and community support resources tailored for seniors. Our platform provides real-time 
            access to professional help and caring communities, ensuring you have the support 
            you need, whenever you need it.
          </p>
          <ul class="feature-list">
            <li>📍 <strong>Nearby Resources:</strong> Find counseling centers closest to your current location.</li>
            <li>🤝 <strong>Community Connection:</strong> Discover groups and professional services for seniors.</li>
            <li>📞 <strong>Quick Access:</strong> Get contact information and directions instantly.</li>
          </ul>
          <router-link to="/nearby-mental-support" class="btn-solid btn-secondary btn-large">
            Find Support Nearby
          </router-link>
        </div>
      </section>
    </div>

    <!-- Footer Credit -->
    <footer class="home-footer">
      <p>&copy; 2026 Melbourne Senior Community Support. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup>
// No script logic needed for now, but keeping setup for future use
</script>

<style scoped>
.home-wrapper {
  overflow-x: hidden;
  scroll-behavior: smooth;
  background-color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* --- Hero Section --- */
.hero-section {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)),
    url('https://images.unsplash.com/photo-1545044846-e5b1cb6a6442?q=80&w=2000&auto=format&fit=crop');
  background-size: cover;
  background-position: center;
  position: relative;
}

.main-intro {
  max-width: 850px;
  margin: 0 20px;
  animation: fadeIn 1s ease-out;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 32px;
  padding: 80px 60px;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
}

.headline {
  font-size: 3.75rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.text-dark { color: #1e293b; }
.text-orange { color: #f97316; }

.description {
  font-size: 1.5rem;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 50px;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #1e293b;
  font-weight: 600;
  opacity: 0.8;
}

.chevron {
  display: block;
  width: 20px;
  height: 20px;
  border-bottom: 3px solid #1e293b;
  border-right: 3px solid #1e293b;
  transform: rotate(45deg);
  animation: bounce 2s infinite;
  margin-bottom: 8px;
}

/* --- Features Sections --- */
.features-container {
  display: flex;
  flex-direction: column;
}

.feature-section {
  padding: 120px 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.routes-bg {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  position: relative;
  overflow: hidden;
}

.routes-bg::after {
  content: "";
  position: absolute;
  right: -5%;
  top: 10%;
  width: 40%;
  height: 80%;
  background-image: url('https://images.unsplash.com/photo-1519331379826-f10be5486c6f?q=80&w=1000&auto=format&fit=crop');
  background-size: cover;
  border-radius: 40px;
  opacity: 0.1;
  transform: rotate(5deg);
  pointer-events: none;
}

.mental-bg {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  position: relative;
  overflow: hidden;
}

.mental-bg::after {
  content: "";
  position: absolute;
  left: -5%;
  bottom: 5%;
  width: 35%;
  height: 70%;
  background-image: url('https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1000&auto=format&fit=crop');
  background-size: cover;
  border-radius: 40px;
  opacity: 0.1;
  transform: rotate(-3deg);
  pointer-events: none;
}

.feature-card {
  max-width: 900px;
  background: white;
  padding: 60px;
  border-radius: 40px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  z-index: 1;
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.badge {
  background: #fef3c7;
  color: #92400e;
  padding: 8px 16px;
  border-radius: 99px;
  font-weight: 700;
  font-size: 0.875rem;
  margin-bottom: 24px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.feature-title {
  font-size: 3rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 20px;
}

.feature-description {
  font-size: 1.25rem;
  color: #475569;
  line-height: 1.7;
  margin-bottom: 32px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin-bottom: 40px;
}

.feature-list li {
  font-size: 1.125rem;
  color: #334155;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-large {
  padding: 18px 40px;
  font-size: 1.125rem;
  letter-spacing: 0.01em;
}

.btn-solid {
  display: inline-block;
  color: white;
  border: none;
  border-radius: 50px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
}

.btn-primary {
  background-color: #f97316;
  box-shadow: 0 10px 20px -5px rgba(249, 115, 22, 0.4);
}

.btn-primary:hover {
  background-color: #ea580c;
  transform: translateY(-4px);
  box-shadow: 0 15px 25px -5px rgba(249, 115, 22, 0.5);
}

.btn-secondary {
  background-color: #3b82f6;
  box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4);
}

.btn-secondary:hover {
  background-color: #2563eb;
  transform: translateY(-4px);
  box-shadow: 0 15px 25px -5px rgba(59, 130, 246, 0.5);
}

.home-footer {
  padding: 60px 40px;
  text-align: center;
  background-color: #0f172a;
  color: #64748b;
  font-size: 1rem;
}

/* --- Animations --- */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {transform: translateY(0) rotate(45deg);}
  40% {transform: translateY(-8px) rotate(45deg);}
  60% {transform: translateY(-4px) rotate(45deg);}
}

/* --- Responsive adjustments --- */
@media (max-width: 1024px) {
  .headline { font-size: 3rem; }
  .feature-card { padding: 40px; }
  .routes-bg::after, .mental-bg::after { display: none; }
}

@media (max-width: 768px) {
  .headline { font-size: 2.25rem; }
  .glass-panel { padding: 40px 20px; border-radius: 20px; }
  .description { font-size: 1.125rem; margin-bottom: 30px; }
  .feature-title { font-size: 2rem; }
  .feature-card { padding: 30px 20px; border-radius: 24px; }
  .feature-description { font-size: 1.05rem; }
  .btn-large { width: 100%; box-sizing: border-box; }
  .feature-list li { font-size: 1rem; }
}
</style>
