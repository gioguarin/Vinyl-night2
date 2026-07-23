import { EventEmitter } from "events";

const g = globalThis as unknown as { __vn_bus?: EventEmitter };
export const bus = g.__vn_bus ?? (g.__vn_bus = new EventEmitter());
bus.setMaxListeners(0);

export const channel = (eventId: string) => `event:${eventId}`;
