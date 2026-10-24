type SiteUrlEnv = {
  PUBLIC_SITE_URL?: string;
  SITE_URL?: string;
};

const DEFAULT_SITE_URL = 'https://ab16clothing.co.uk';

/** Supports the documented key and the key already used by the deployed function. */
export function resolveSiteOrigin(env: SiteUrlEnv): string {
  const configuredUrl = env.PUBLIC_SITE_URL?.trim() || env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  return new URL(configuredUrl).origin;
}
