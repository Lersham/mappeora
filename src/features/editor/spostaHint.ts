/**
 * On a touch screen a finger on a concept moves the whole map: the concepts
 * stay where the sheet puts them until «Sposta» frees them. A child who tries
 * to drag one and sees the map move instead is told once where «Sposta» is.
 * A few times on this device at most, never again once «Sposta» was used:
 * moving the map from a concept is what most children mean to do.
 */
const KEY = 'mappeora-sposta-hint';
const MAX_SHOWN = 3;

/** How many times it was shown here; the most when the storage can't be read. */
function shown(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return MAX_SHOWN;
  }
}

function save(times: number) {
  try {
    localStorage.setItem(KEY, String(times));
  } catch {
    // Private browsing: the hint is only a convenience.
  }
}

export const spostaHintDue = () => shown() < MAX_SHOWN;
export const spostaHintShown = () => save(shown() + 1);
/** «Sposta» was found: no need to point at it any more. */
export const spostaUsed = () => save(MAX_SHOWN);

/** Where «Sposta» is: in the bar, or in «Altro» when the bar can't hold it. */
export const spostaHintText = (inAltro: boolean) =>
  inAltro
    ? 'Per mettere i concetti dove vuoi, premi «Altro» e poi «Sposta».'
    : 'Per mettere i concetti dove vuoi, premi «Sposta», qui sotto.';
