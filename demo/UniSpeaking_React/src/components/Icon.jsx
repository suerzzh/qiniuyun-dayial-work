import React from "react";

const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M5 18l-1 3 4-2h8a5 5 0 0 0 5-5V8a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v6a5 5 0 0 0 2 4z"/>',
  play: '<path d="m9 7 8 5-8 5z"/>',
  pause: '<path d="M9 7v10M15 7v10"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  help: '<path d="M8.8 9a3.2 3.2 0 1 1 5.2 2.5c-1.2.8-2 1.3-2 2.5M12 18h.01"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>',
  book: '<path d="M4 5.5c3-1 5-.4 8 1.5v12c-3-1.9-5-2.5-8-1.5zM20 5.5c-3-1-5-.4-8 1.5v12c3-1.9 5-2.5 8-1.5z"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a8 8 0 0 0-1.8 1L5 6.1 3 9.5 5.1 11a7 7 0 0 0 0 2L3 14.5 5 18l2.4-1a8 8 0 0 0 1.8 1l.4 3h4.8l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  volume: '<path d="M5 10v4h3l4 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

export default function Icon({ name, className = "" }) {
  const htmlContent = paths[name] || paths.arrow;
  return (
    <svg
      className={`icon ${className}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
