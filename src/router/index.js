import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MyRoutesView from '../views/MyRoutesView.vue'
import NearbyMentalSupportView from '../views/NearbyMentalSupportView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/my-routes', name: 'my-routes', component: MyRoutesView },
    {
      path: '/nearby-mental-support',
      name: 'nearby-mental-support',
      component: NearbyMentalSupportView
    },
    { path: '/dashboard', name: 'dashboard', component: DashboardView }
  ],
})

export default router
