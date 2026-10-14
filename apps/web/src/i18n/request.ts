import { getRequestConfig } from "next-intl/server";

/**
 * Single locale for now (no i18n routing). Adding Catalan/English means adding
 * messages/<locale>.json and switching to locale-prefixed routes.
 */
export const DEFAULT_LOCALE = "es";

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
  timeZone: "Europe/Madrid",
}));
