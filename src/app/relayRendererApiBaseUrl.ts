/** In dev, route the renderer through Vite's /api proxy so fetch stays same-origin. */
export const relayRendererApiBaseUrl = (
  rendererUrl: string | undefined,
  httpApiBaseUrl: string
): string => {
  if (!rendererUrl) return httpApiBaseUrl;
  try {
    return new URL(rendererUrl).origin;
  } catch {
    return httpApiBaseUrl;
  }
};
