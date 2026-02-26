import { onRequest as __api_og__slug__ts_onRequest } from "/Users/julienvinckel/Documents/OEP/Mobilisator/functions/api/og/[slug].ts"
import { onRequest as __og__slug__ts_onRequest } from "/Users/julienvinckel/Documents/OEP/Mobilisator/functions/og/[slug].ts"
import { onRequest as ____path___ts_onRequest } from "/Users/julienvinckel/Documents/OEP/Mobilisator/functions/[[path]].ts"

export const routes = [
    {
      routePath: "/api/og/:slug",
      mountPath: "/api/og",
      method: "",
      middlewares: [],
      modules: [__api_og__slug__ts_onRequest],
    },
  {
      routePath: "/og/:slug",
      mountPath: "/og",
      method: "",
      middlewares: [],
      modules: [__og__slug__ts_onRequest],
    },
  {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___ts_onRequest],
    },
  ]