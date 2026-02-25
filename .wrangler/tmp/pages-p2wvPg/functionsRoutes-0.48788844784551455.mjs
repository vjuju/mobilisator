import { onRequest as __og__slug__ts_onRequest } from "/Users/julienvinckel/Documents/OEP/Mobilisator/functions/og/[slug].ts"
import { onRequest as ____path___ts_onRequest } from "/Users/julienvinckel/Documents/OEP/Mobilisator/functions/[[path]].ts"

export const routes = [
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