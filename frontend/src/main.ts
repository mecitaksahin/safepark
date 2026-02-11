import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { refreshSetupStatus } from "./state/setup";
import "./style.css";

void refreshSetupStatus();

createApp(App).use(router).mount("#app");
