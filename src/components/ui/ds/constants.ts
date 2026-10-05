/**
 * Medidas que el diseño (.dc.html) usa pero que NO están en los tokens de espaciado/radio.
 * Se centralizan aquí, con su origen, para no esparcir números mágicos. Ver las discrepancias
 * reportadas en F3.
 */

/** Margen horizontal de pantalla y padding de hojas (Dashboard.dc.html: padding: ... 20px). */
export const SCREEN_MARGIN = 20;

/** Padding del widget hero (Dashboard.dc.html:142, padding: 20px; el estándar es space-4 = 16). */
export const HERO_PADDING = 20;

/** Radio del contenedor del control segmentado (Dashboard.dc.html:818, border-radius: 10px). */
export const SEGMENTED_RADIUS = 10;

/** Alto mínimo de un área táctil (guía de accesibilidad de plataforma). */
export const MIN_TOUCH = 44;

/** Fondo del velo detrás de una hoja (ConfirmacionPago.dc.html:35). */
export const SCRIM_COLOR = 'rgba(14,33,28,0.5)';

/** Tamaño del monto protagonista de MoneyInput 'hero' (Dashboard.dc.html:825, font-size: 44px). */
export const MONEY_HERO_SIZE = 44;

/** Tamaño de texto de MoneyInput 'field' (Dashboard.dc.html:1560, font-size: 16px; no hay token mono de 16). */
export const MONEY_FIELD_SIZE = 16;

/** Grosor y separación del anillo de foco (focus-ring). */
export const FOCUS_RING_WIDTH = 2;
export const FOCUS_RING_OFFSET = 2;
