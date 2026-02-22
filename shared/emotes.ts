// Emote catalog — shared between server and client

export interface EmoteDefinition {
  id: string;
  key: string;       // keyboard key '1'-'9'
  label: string;     // displayed emoji/text
  name: string;      // display name
  premium: boolean;
}

export const EMOTE_CATALOG: EmoteDefinition[] = [
  // Free emotes (keys 1-5)
  { id: 'emote:gg',      key: '1', label: 'GG',   name: 'GG',             premium: false },
  { id: 'emote:nice',    key: '2', label: '\u{1F44D}',  name: 'Nice',           premium: false },
  { id: 'emote:lol',     key: '3', label: '\u{1F602}',  name: 'LOL',            premium: false },
  { id: 'emote:wow',     key: '4', label: '\u{1F62E}',  name: 'Wow',            premium: false },
  { id: 'emote:panic',   key: '5', label: '\u{1F631}',  name: 'Panic',          premium: false },
  // Premium emotes (keys 6-9)
  { id: 'emote:shipit',  key: '6', label: '\u{1F680}',  name: 'Ship It',        premium: true },
  { id: 'emote:duck',    key: '7', label: '\u{1F986}',  name: 'Rubber Duck',    premium: true },
  { id: 'emote:stack',   key: '8', label: '\u{1F4DA}',  name: 'Stack Overflow', premium: true },
  { id: 'emote:404',     key: '9', label: '\u{1F50D}',  name: '404 Not Found',  premium: true },
];

/** Lookup by emote id */
export const EMOTE_MAP = new Map(EMOTE_CATALOG.map(e => [e.id, e]));

/** Set of free emote ids */
export const FREE_EMOTE_IDS = new Set(EMOTE_CATALOG.filter(e => !e.premium).map(e => e.id));
