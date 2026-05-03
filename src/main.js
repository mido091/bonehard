/**
 * main.js
 * ─────────────────────────────────────────────────────
 * Application entry point.
 * Mounts the Vue app with the global router and injects the
 * project-wide stylesheet before attaching to the #app DOM node.
 */
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles.css';

createApp(App).use(router).mount('#app');
