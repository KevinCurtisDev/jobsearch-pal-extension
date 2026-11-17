// Minimal typing for the part of jsdom the unit tests use (no @types/jsdom dependency).
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    readonly window: Window & typeof globalThis;
  }
}
