/// <reference types="vite/client" />

declare module '*?retry';

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
