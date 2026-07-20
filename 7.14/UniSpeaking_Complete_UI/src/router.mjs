const ROUTES = [
  { name: "conversation", pattern: /^#\/conversation\/?$/ },
  { name: "scenes", pattern: /^#\/scenes\/?$/ },
  { name: "ielts", pattern: /^#\/ielts\/?$/ },
  { name: "review", pattern: /^#\/review\/?$/ },
  { name: "review-detail", pattern: /^#\/review\/([^/]+)\/?$/, keys: ["scene"] },
  { name: "training", pattern: /^#\/training\/([^/]+)\/(words|sentences|simulation|diagnostic)\/?$/, keys: ["scene", "stage"] },
  { name: "profile", pattern: /^#\/profile\/(overview|assets|scenes|settings)\/?$/, keys: ["section"] },
  { name: "auth", pattern: /^#\/auth\/?$/ },
  { name: "membership", pattern: /^#\/membership\/?$/ },
  { name: "custom-scene-generating", pattern: /^#\/custom-scene\/generating\/?$/ },
  { name: "custom-scene-preview", pattern: /^#\/custom-scene\/preview\/?$/ },
];

export function parseRoute(hash = "") {
  const value = hash || "#/conversation";
  for (const route of ROUTES) {
    const match = value.match(route.pattern);
    if (!match) continue;
    const params = Object.fromEntries((route.keys || []).map((key, index) => [key, match[index + 1]]));
    return { name: route.name, params, invalid: false };
  }
  return { name: "conversation", params: {}, invalid: true };
}

export function routeHref(name, params = {}) {
  const routes = {
    conversation: "#/conversation",
    scenes: "#/scenes",
    ielts: "#/ielts",
    review: "#/review",
    "review-detail": `#/review/${params.scene || "cafe"}`,
    training: `#/training/${params.scene || "cafe"}/${params.stage || "words"}`,
    profile: `#/profile/${params.section || "overview"}`,
    auth: "#/auth",
    membership: "#/membership",
    "custom-scene-generating": "#/custom-scene/generating",
    "custom-scene-preview": "#/custom-scene/preview",
  };
  return routes[name] || routes.conversation;
}

export function globalSection(route) {
  if (route.name === "ielts" || route.name === "training" || route.name === "scenes" || route.name === "custom-scene-generating" || route.name === "custom-scene-preview") return "scenes";
  if (route.name === "review" || route.name === "review-detail") return "review";
  if (route.name === "profile") return "profile";
  if (route.name === "membership") return "membership";
  if (route.name === "auth") return "auth";
  return "conversation";
}
