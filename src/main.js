import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import busy from './directives/busy'
import './style.css'

createApp(App).use(createPinia()).use(router).use(busy).mount('#app')
