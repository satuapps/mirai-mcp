/** Production API host. Paths are under /v1 and /publik. */
export const DEFAULT_BASE_URL = "https://satuapps.com";

/** Public docs and API key setup. */
export const DOCS_URL = "https://satuapps.com/docs";

/** Web chat for sign in and free daily quota. */
export const CHAT_URL = "https://satuapps.com/chat";

/** Guest header used by the public chat surface. */
export const HEADER_TAMU = "X-Mirai-Tamu";

/** Hint appended when guest quota is exhausted without an API key. */
export const KEY_HINT =
  `Set MIRAI_API_KEY after you create a free key. Open ${DOCS_URL} for setup steps. ` +
  `You can also sign in at ${CHAT_URL} to continue with your account quota.`;
