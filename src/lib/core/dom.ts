/**
 * The parts of the control's rendered DOM that hosts may hook into, for
 * example to decorate each catalog row. These names are public API: renaming
 * one is a breaking change. The module has no dependencies, so importing it
 * does not pull in the rest of the package.
 */

/** Class name of the control's dropdown panel element. */
export const BASEMAP_PANEL_CLASS = 'basemap-control-panel';

/** Class name of each basemap row in the panel's catalog list. */
export const BASEMAP_ROW_CLASS = 'basemap-control-result';

/** Attribute on each catalog row holding the row's `BasemapDefinition.id`. */
export const BASEMAP_ROW_ID_ATTRIBUTE = 'data-basemap-id';

/** CSS selector matching the control's panel element. */
export const BASEMAP_PANEL_SELECTOR = `.${BASEMAP_PANEL_CLASS}`;

/** CSS selector matching every catalog row. */
export const BASEMAP_ROW_SELECTOR = `.${BASEMAP_ROW_CLASS}`;
