import { Preset, PRESET_CONFIGS, PresetConfig } from "./types";

export function getPresetConfig(preset: Preset): PresetConfig {
  return PRESET_CONFIGS[preset];
}

export function presetFromString(name: string): Preset {
  const normalized = name.toLowerCase().replace(/[-_\s]/g, "");
  switch (normalized) {
    case "minimal":
    case "sss1":
      return Preset.Minimal;
    case "compliant":
    case "sss2":
      return Preset.Compliant;
    case "private":
    case "sss3":
      return Preset.Private;
    default:
      throw new Error(
        `Unknown preset "${name}". Valid presets: minimal (sss-1), compliant (sss-2), private (sss-3)`
      );
  }
}

export function presetToString(preset: Preset): string {
  switch (preset) {
    case Preset.Minimal:
      return "SSS-1 (Minimal)";
    case Preset.Compliant:
      return "SSS-2 (Compliant)";
    case Preset.Private:
      return "SSS-3 (Private)";
    default:
      return `Unknown (${preset})`;
  }
}

export function validatePreset(value: number): Preset {
  if (value >= 1 && value <= 3) {
    return value as Preset;
  }
  throw new Error(`Invalid preset value: ${value}. Must be 1, 2, or 3.`);
}

export function presetRequiresHookProgram(preset: Preset): boolean {
  return PRESET_CONFIGS[preset].hasTransferHook;
}

export function presetSupportsPermanentDelegate(preset: Preset): boolean {
  return PRESET_CONFIGS[preset].hasPermanentDelegate;
}

export function presetSupportsConfidentialTransfers(preset: Preset): boolean {
  return PRESET_CONFIGS[preset].hasConfidentialTransfers;
}
