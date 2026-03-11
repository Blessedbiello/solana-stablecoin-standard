/**
 * Dashboard layout and rendering for the SSS TUI.
 *
 * The layout is composed of blessed boxes arranged in a responsive grid.
 * blessed-contrib widgets (Table, Gauge, Log) are used where appropriate.
 *
 * Panel map (approximate percentages of terminal area):
 *
 *   ┌────────────────────────── header (3 rows) ─────────────────────────────┐
 *   │ supply (top-left, 25%)    │ config (top-right, 75%)                    │
 *   │ gauge + stats             │ key/value pairs                             │
 *   ├───────────────────────────┴────────────────────────────────────────────┤
 *   │ events table (middle, full width, ~30%)                                │
 *   ├───────────────────────────┬────────────────────────────────────────────┤
 *   │ roles table (bottom-left) │ minters table (bottom-right)               │
 *   ├───────────────────────────┴────────────────────────────────────────────┤
 *   │ status bar (1 row)                                                     │
 *   └────────────────────────────────────────────────────────────────────────┘
 */

import * as blessed from "blessed";
import * as contrib from "blessed-contrib";
import {
  BorderStyle,
  DimBorderStyle,
  Colors,
  TableHeaderFg,
  TableCellFg,
  GaugeFill,
  GaugeStroke,
} from "./theme";
import type { DashboardData, SupplyInfo, ConfigInfo } from "./data";
import { PRESET_LABELS } from "./data";

// ---------------------------------------------------------------------------
// Type helpers — blessed-contrib widgets lack complete @types coverage
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWidget = any;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Left-pad a string to a fixed width. */
function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

/** Format a number with locale thousands separators. */
function fmtNum(n: bigint, decimals: number): string {
  if (decimals === 0) return n.toLocaleString();
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = (n % divisor).toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toLocaleString()}.${frac}`;
}

/** Truncate address for compact display. */
function shortAddr(addr: string, chars = 6): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

/** Return a symbol-tag for a preset. */
function presetTag(preset: number): string {
  return PRESET_LABELS[preset] ?? `Unknown(${preset})`;
}

// ---------------------------------------------------------------------------
// Dashboard class
// ---------------------------------------------------------------------------

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private grid: AnyWidget;

  // Panels
  private headerBox!: blessed.Widgets.BoxElement;
  private supplyBox!: blessed.Widgets.BoxElement;
  private supplyGauge!: AnyWidget;
  private configBox!: blessed.Widgets.BoxElement;
  private eventsTable!: AnyWidget;
  private rolesTable!: AnyWidget;
  private mintersTable!: AnyWidget;
  private statusBar!: blessed.Widgets.BoxElement;

  /** Currently focused panel index (for Tab cycling). */
  private focusIndex = 0;
  private focusablePanels: blessed.Widgets.BoxElement[] = [];

  /** Cluster name shown in the header. */
  private cluster: string;

  constructor(screen: blessed.Widgets.Screen, cluster: string) {
    this.screen = screen;
    this.cluster = cluster;
    this.buildLayout();
  }

  // -------------------------------------------------------------------------
  // Layout construction
  // -------------------------------------------------------------------------

  private buildLayout(): void {
    const screen = this.screen;

    // blessed-contrib grid: 12 rows x 12 columns
    this.grid = new contrib.grid({ rows: 12, cols: 12, screen });

    // --- Header (row 0, col 0-11, height 1 row) ---------------------------
    this.headerBox = this.grid.set(0, 0, 1, 12, blessed.box, {
      content: this.headerContent(),
      tags: true,
      style: {
        fg: Colors.white,
        bg: Colors.primary,
        bold: true,
      },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
    });

    // --- Supply stats box (rows 1-2, cols 0-3) ----------------------------
    this.supplyBox = this.grid.set(1, 0, 2, 4, blessed.box, {
      label: " Supply ",
      tags: true,
      border: BorderStyle,
      style: { border: { fg: Colors.primary }, label: { fg: Colors.primary } },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
    });

    // --- Circulating supply gauge (row 3, cols 0-3) -----------------------
    this.supplyGauge = this.grid.set(3, 0, 1, 4, contrib.gauge, {
      label: " Circulating ",
      stroke: GaugeFill,
      fill: GaugeStroke,
      border: DimBorderStyle,
      style: { border: { fg: Colors.muted }, label: { fg: Colors.muted } },
    });

    // --- Config panel (rows 1-3, cols 4-11) --------------------------------
    this.configBox = this.grid.set(1, 4, 3, 8, blessed.box, {
      label: " Config ",
      tags: true,
      border: BorderStyle,
      style: { border: { fg: Colors.primary }, label: { fg: Colors.primary } },
      scrollable: false,
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
    });

    // --- Events table (rows 4-6, cols 0-11) --------------------------------
    this.eventsTable = this.grid.set(4, 0, 3, 12, contrib.table, {
      label: " Recent Events ",
      keys: true,
      interactive: false,
      border: BorderStyle,
      style: {
        border: { fg: Colors.primary },
        label: { fg: Colors.primary },
        header: { fg: TableHeaderFg, bold: true },
        cell: { fg: TableCellFg },
      },
      columnSpacing: 2,
      columnWidth: [20, 22, 65],
    });

    // --- Roles table (rows 7-10, cols 0-5) ---------------------------------
    this.rolesTable = this.grid.set(7, 0, 4, 6, contrib.table, {
      label: " Active Roles ",
      keys: true,
      interactive: false,
      border: BorderStyle,
      style: {
        border: { fg: Colors.primary },
        label: { fg: Colors.primary },
        header: { fg: TableHeaderFg, bold: true },
        cell: { fg: TableCellFg },
      },
      columnSpacing: 2,
      columnWidth: [14, 16, 16, 22],
    });

    // --- Minters table (rows 7-10, cols 6-11) ------------------------------
    this.mintersTable = this.grid.set(7, 6, 4, 6, contrib.table, {
      label: " Minters ",
      keys: true,
      interactive: false,
      border: BorderStyle,
      style: {
        border: { fg: Colors.primary },
        label: { fg: Colors.primary },
        header: { fg: TableHeaderFg, bold: true },
        cell: { fg: TableCellFg },
      },
      columnSpacing: 2,
      columnWidth: [14, 14, 14, 8, 6],
    });

    // --- Status bar (row 11, cols 0-11) ------------------------------------
    this.statusBar = this.grid.set(11, 0, 1, 12, blessed.box, {
      tags: true,
      style: { fg: Colors.muted, bg: Colors.black },
      padding: { left: 1, right: 1, top: 0, bottom: 0 },
      content: this.statusContent(null),
    });

    // Register focusable panels for Tab cycling
    this.focusablePanels = [
      this.supplyBox,
      this.configBox,
      this.eventsTable,
      this.rolesTable,
      this.mintersTable,
    ];

    screen.render();
  }

  // -------------------------------------------------------------------------
  // Content builders
  // -------------------------------------------------------------------------

  private headerContent(): string {
    const cluster = this.cluster.toUpperCase();
    const now = new Date().toLocaleTimeString();
    const title = "Solana Stablecoin Standard  --  Admin Dashboard";
    const right = `[${cluster}]  ${now}`;
    // Use spaces to push right section to the edge (approximate)
    return ` {bold}${title}{/bold}${" ".repeat(4)}${right}`;
  }

  private statusContent(data: DashboardData | null): string {
    const mode = data?.isLive ? "{green-fg}LIVE{/green-fg}" : "{yellow-fg}DEMO{/yellow-fg}";
    const refreshed = data
      ? `Last refresh: ${new Date(data.lastRefreshed).toLocaleTimeString()}`
      : "Not yet loaded";
    const err = data?.fetchError
      ? `  {red-fg}Error: ${data.fetchError.slice(0, 60)}{/red-fg}`
      : "";
    const hints =
      " {cyan-fg}q{/cyan-fg} Quit  {cyan-fg}Tab{/cyan-fg} Switch panel  {cyan-fg}r{/cyan-fg} Refresh";
    return `${hints}   ${mode}  ${refreshed}${err}`;
  }

  private supplyContent(supply: SupplyInfo): string {
    const { totalMinted, totalBurned, circulating, decimals } = supply;
    const lines: string[] = [
      `{bold}{cyan-fg}Total Minted  :{/cyan-fg}{/bold}  ${fmtNum(totalMinted, decimals)}`,
      `{bold}{red-fg}Total Burned  :{/red-fg}{/bold}  ${fmtNum(totalBurned, decimals)}`,
      `{bold}{green-fg}Circulating   :{/green-fg}{/bold}  ${fmtNum(circulating, decimals)}`,
      "",
      `{bold}{cyan-fg}Circ. Ratio   :{/cyan-fg}{/bold}  ${supply.circulatingPct.toFixed(2)}%`,
    ];
    return lines.join("\n");
  }

  private configContent(cfg: ConfigInfo): string {
    const paused = cfg.paused
      ? "{red-fg}YES (PAUSED){/red-fg}"
      : "{green-fg}NO{/green-fg}";
    const hook = cfg.hasTransferHook
      ? "{green-fg}Enabled{/green-fg}"
      : "{yellow-fg}Disabled{/yellow-fg}";
    const pending = cfg.pendingAuthority
      ? `{yellow-fg}${shortAddr(cfg.pendingAuthority)}{/yellow-fg}`
      : "{gray-fg}None{/gray-fg}";
    const rows: [string, string][] = [
      ["Config PDA", shortAddr(cfg.address)],
      ["Mint", shortAddr(cfg.mintAddress)],
      ["Authority", shortAddr(cfg.authority)],
      ["Pending Auth", pending],
      ["Preset", presetTag(cfg.preset)],
      ["Decimals", cfg.decimals.toString()],
      ["Config ID", cfg.configId],
      ["Transfer Hook", hook],
      ["Paused", paused],
    ];
    return rows
      .map(([k, v]) => `{bold}{cyan-fg}${pad(k, 14)}{/cyan-fg}{/bold}  ${v}`)
      .join("\n");
  }

  // -------------------------------------------------------------------------
  // Public render method — called on initial load and on every refresh
  // -------------------------------------------------------------------------

  render(data: DashboardData): void {
    // Header
    this.headerBox.setContent(this.headerContent());

    // Supply panel text
    this.supplyBox.setContent(this.supplyContent(data.supply));

    // Supply gauge — clamp to [0, 100] to guard against rounding artefacts
    const pct = Math.max(0, Math.min(100, Math.round(data.supply.circulatingPct)));
    this.supplyGauge.setPercent(pct);

    // Config panel
    this.configBox.setContent(this.configContent(data.config));

    // Events table
    this.eventsTable.setData({
      headers: ["Type", "Timestamp", "Details"],
      data: data.events.map((e) => [e.type, e.timestamp, e.details]),
    });

    // Roles table
    this.rolesTable.setData({
      headers: ["Role", "Holder", "Assigned By", "Assigned At"],
      data: data.roles.map((r) => [r.role, r.holder, r.assignedBy, r.assignedAt]),
    });

    // Minters table
    this.mintersTable.setData({
      headers: ["Address", "Allowance", "Minted", "Used%", "Active"],
      data: data.minters.map((m) => [
        m.address,
        m.allowance,
        m.minted,
        m.usedPct,
        m.active,
      ]),
    });

    // Status bar
    this.statusBar.setContent(this.statusContent(data));

    this.screen.render();
  }

  /** Show a loading message before the first data fetch completes. */
  renderLoading(): void {
    this.supplyBox.setContent(
      "\n  {yellow-fg}Loading...{/yellow-fg}"
    );
    this.configBox.setContent(
      "\n  {yellow-fg}Fetching config from chain...{/yellow-fg}"
    );
    this.statusBar.setContent(this.statusContent(null));
    this.screen.render();
  }

  /** Show a connection-error banner in the status bar. */
  renderError(message: string): void {
    this.statusBar.setContent(
      ` {red-fg}Connection error: ${message.slice(0, 100)}{/red-fg}` +
        "  | {cyan-fg}r{/cyan-fg} Retry  {cyan-fg}q{/cyan-fg} Quit"
    );
    this.screen.render();
  }

  // -------------------------------------------------------------------------
  // Focus management
  // -------------------------------------------------------------------------

  /** Advance focus to the next panel in the cycle. */
  focusNext(): void {
    const panels = this.focusablePanels;
    // Reset current border
    const current = panels[this.focusIndex];
    (current as AnyWidget).style = {
      ...(current as AnyWidget).style,
      border: { fg: Colors.primary },
    };

    this.focusIndex = (this.focusIndex + 1) % panels.length;
    const next = panels[this.focusIndex];
    (next as AnyWidget).style = {
      ...(next as AnyWidget).style,
      border: { fg: Colors.secondary },
    };
    next.focus();
    this.screen.render();
  }
}
