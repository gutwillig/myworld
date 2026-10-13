/** Pixels moved during the current/last pointer drag; clicks after an orbit drag are ignored. */
export const dragState = { distance: 0 };

export const CLICK_SLOP = 6;

export const wasDrag = (): boolean => dragState.distance > CLICK_SLOP;

/** Island-local ground point under the pointer while moving a building. */
export const dragPoint = { x: 0, z: 0, has: false };
