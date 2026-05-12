import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // __SW_MANIFEST is injected by Serwist
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => {
        // Cache the player HTML and JS chunks
        return (
          request.destination === "document" ||
          request.destination === "script" ||
          request.destination === "style" ||
          request.destination === "font"
        );
      },
      handler: new StaleWhileRevalidate({
        cacheName: "nuexis-app-shell",
        plugins: [
          {
            cacheWillUpdate: async ({ response }) => {
              return response;
            },
          },
        ],
      }),
    },
  ],
});

serwist.addEventListeners();