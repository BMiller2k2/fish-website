// Used for the GitHub Pages build (no backend available): the catalog reads
// from a bundled JSON file instead of /api/fish, and the chat widget + admin
// sign-in are disabled rather than calling an API that doesn't exist there.
export const environment = {
  staticDemo: true,
};
