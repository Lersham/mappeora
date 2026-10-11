/** How many line colours the branches of a "foglio" map take turns with (see theme.css). */
export const BRANCH_COLORS = 6;

/** CSS classes for a line of branch `branch` (none outside a sheet). */
export const branchClass = (branch?: number) => (branch === undefined ? undefined : `branch-line branch-${branch % BRANCH_COLORS}`);
