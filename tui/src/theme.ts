/**
 * Color theme and border style constants for the SSS TUI dashboard.
 *
 * All colors use blessed's string color names so they work across
 * xterm-256 and basic 16-color terminals.
 */

export const Colors = {
  primary: "cyan",
  secondary: "green",
  warning: "yellow",
  error: "red",
  muted: "gray",
  white: "white",
  black: "black",
  brightCyan: "bright-cyan",
  brightGreen: "bright-green",
  brightYellow: "bright-yellow",
  brightRed: "bright-red",
  darkBg: "black",
  panelBg: "#1a1a2e",
} as const;

export type Color = (typeof Colors)[keyof typeof Colors];

/** Standard border style used by all panels. */
export const BorderStyle = {
  type: "line" as const,
  fg: Colors.primary,
};

/** Dimmed border style used for inactive / secondary panels. */
export const DimBorderStyle = {
  type: "line" as const,
  fg: Colors.muted,
};

/** Selected / focused border style. */
export const FocusBorderStyle = {
  type: "line" as const,
  fg: Colors.secondary,
};

/** Label style used in box titles. */
export const LabelStyle = {
  bold: true,
  fg: Colors.primary,
};

/** Positive-value style (supplies, active statuses). */
export const PositiveStyle = {
  fg: Colors.secondary,
};

/** Warning-value style (paused, partial allowance). */
export const WarningStyle = {
  fg: Colors.warning,
};

/** Error / negative-value style. */
export const ErrorStyle = {
  fg: Colors.error,
};

/** Muted text style for secondary information. */
export const MutedStyle = {
  fg: Colors.muted,
};

/** Standard padding for inner content. */
export const InnerPadding = {
  top: 0,
  right: 1,
  bottom: 0,
  left: 1,
};

/** Table header foreground color. */
export const TableHeaderFg = Colors.primary;

/** Table cell foreground color. */
export const TableCellFg = Colors.white;

/** Gauge fill color. */
export const GaugeFill = Colors.secondary;

/** Gauge stroke color. */
export const GaugeStroke = Colors.muted;
