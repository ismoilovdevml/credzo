/** `data-*` attributes (e.g. `data-testid`) that a component forwards to its root or interactive element. */
export type DataAttributes = { [key: `data-${string}`]: string | number | boolean | undefined };
