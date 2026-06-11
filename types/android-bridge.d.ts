// Global type declaration for the NuExis Android native bridge.
// This file is automatically included by TypeScript (via tsconfig "include": ["**/*.ts"])
// so window.Android is recognized in every file without any explicit import.
// NOTE: No import/export statements — this must remain a script-mode file so the
// interface Window augmentation is applied globally without needing any imports.

interface Window {
  Android?: {
    isNuExisPlayer: boolean;
    version: string;
    getNativeHardwareId: () => string;
    getNativeSecret: () => string | null;
    setNativeSecret: (secret: string) => void;
    clearNativeSecret: () => void;
    showWebsiteOverlay: (
      id: string,
      url: string,
      x: number,
      y: number,
      width: number,
      height: number,
      viewportWidth: number,
      viewportHeight: number
    ) => void;
    hideWebsiteOverlay: (id: string) => void;
    hideAllWebsiteOverlays: () => void;
    setOrientation: (degrees: number) => void;
    cacheAsset: (url: string, cacheKey: string, mimeType: string) => void;
    log: (level: string, event: string, fields?: Record<string, unknown>) => void;
    heartbeat: () => void;
    getHealthSnapshot: () => string;
    getRecentLogs: () => string;
    reload: () => void;
  };
}
