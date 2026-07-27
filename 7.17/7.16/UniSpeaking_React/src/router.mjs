const ROUTES = [
  { name: "conversation", pattern: /^#\/conversation\/?$/ },
  { name: "scenes", pattern: /^#\/scenes\/?$/ },
  { name: "review", pattern: /^#\/review\/?$/ },
  { name: "review-detail", pattern: /^#\/review\/([^/]+)\/?$/, keys: ["scene"] },
  { name: "training", pattern: /^#\/training\/([^/]+)\/(words|sentences|simulation)(?:\?.*)?$/, keys: ["scene", "stage"] },
  { name: "profile", pattern: /^#\/profile\/(overview|membership|settings)\/?$/, keys: ["section"] },
  { name: "auth", pattern: /^#\/auth\/?$/ },
  { name: "membership", pattern: /^#\/membership\/?$/ },
  { name: "custom-scene-generating", pattern: /^#\/custom-scene\/generating\/?$/ },
  { name: "custom-scene-preview", pattern: /^#\/custom-scene\/preview\/?$/ },
];

/** @param {string} [hash] */
export function parseRoute(hash = "") {
  const value = hash || "#/conversation";
  for (const route of ROUTES) {
    const match = value.match(route.pattern);
    if (!match) continue;
    const params = Object.fromEntries(
      (route.keys || []).map((key, index) => [key, match[index + 1]])
    );
    return { name: route.name, params, invalid: false };
  }
  return { name: "conversation", params: {}, invalid: true };
}

/**
 * @param {string} name
 * @param {{ scene?: string, stage?: string, section?: string }} [params]
 */
export function routeHref(name, params = {}) {
  if (name === "training") return `#/training/${params.scene || "cafe"}/${params.stage || "words"}`;
  if (name === "review-detail") return `#/review/${params.scene || "cafe"}`;
  if (name === "profile") return `#/profile/${params.section || "overview"}`;
  return `#/${name || "conversation"}`;
}

/** @param {string} routeName */
export function globalSection(routeName) {
  if (["training", "scenes", "custom-scene-generating", "custom-scene-preview"].includes(routeName)) return "scenes";
  if (["review", "review-detail"].includes(routeName)) return "review";
  if (["profile", "membership"].includes(routeName)) return "profile";
  if (routeName === "auth") return "auth";
  return "conversation";
}
