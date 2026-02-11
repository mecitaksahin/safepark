import { createRouter, createWebHistory } from "vue-router";
import DashboardPage from "../pages/DashboardPage.vue";
import InstallPage from "../pages/InstallPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import { refreshSetupStatus } from "../state/setup";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "root", component: LoginPage },
    { path: "/install", name: "install", component: InstallPage },
    { path: "/login", name: "login", component: LoginPage },
    { path: "/dashboard", name: "dashboard", component: DashboardPage },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async (to) => {
  const installed = await refreshSetupStatus();

  if (to.path === "/") {
    return { path: installed ? "/login" : "/install" };
  }

  if (!installed && to.path !== "/install") {
    return { path: "/install" };
  }

  if (installed && to.path === "/install") {
    return { path: "/login" };
  }

  return true;
});

export default router;
