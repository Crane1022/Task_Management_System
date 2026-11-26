import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import busy from './directives/busy'
import './styles/motion.css' // transitions and small animations (style.css comes after, so it wins where both set something)
import './style.css'

createApp(App).use(createPinia()).use(router).use(busy).mount('#app')
