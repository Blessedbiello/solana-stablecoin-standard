import { expect } from "chai";
import {
  Preset,
  getPresetConfig,
  presetFromString,
  presetToString,
  validatePreset,
  presetRequiresHookProgram,
  presetSupportsPermanentDelegate,
  presetSupportsConfidentialTransfers,
} from "../src";

describe("Presets", () => {
  describe("getPresetConfig", () => {
    it("returns SSS-1 Minimal config", () => {
      const config = getPresetConfig(Preset.Minimal);
      expect(config.preset).to.equal(Preset.Minimal);
      expect(config.hasTransferHook).to.be.false;
      expect(config.hasPermanentDelegate).to.be.false;
      expect(config.hasConfidentialTransfers).to.be.false;
    });

    it("returns SSS-2 Compliant config", () => {
      const config = getPresetConfig(Preset.Compliant);
      expect(config.preset).to.equal(Preset.Compliant);
      expect(config.hasTransferHook).to.be.true;
      expect(config.hasPermanentDelegate).to.be.true;
      expect(config.hasConfidentialTransfers).to.be.false;
    });

    it("returns SSS-3 Private config", () => {
      const config = getPresetConfig(Preset.Private);
      expect(config.preset).to.equal(Preset.Private);
      expect(config.hasTransferHook).to.be.true;
      expect(config.hasPermanentDelegate).to.be.true;
      expect(config.hasConfidentialTransfers).to.be.true;
    });
  });

  describe("presetFromString", () => {
    it("parses minimal", () => {
      expect(presetFromString("minimal")).to.equal(Preset.Minimal);
      expect(presetFromString("Minimal")).to.equal(Preset.Minimal);
      expect(presetFromString("sss1")).to.equal(Preset.Minimal);
      expect(presetFromString("sss-1")).to.equal(Preset.Minimal);
      expect(presetFromString("SSS_1")).to.equal(Preset.Minimal);
    });

    it("parses compliant", () => {
      expect(presetFromString("compliant")).to.equal(Preset.Compliant);
      expect(presetFromString("sss2")).to.equal(Preset.Compliant);
      expect(presetFromString("sss-2")).to.equal(Preset.Compliant);
    });

    it("parses private", () => {
      expect(presetFromString("private")).to.equal(Preset.Private);
      expect(presetFromString("sss3")).to.equal(Preset.Private);
      expect(presetFromString("sss-3")).to.equal(Preset.Private);
    });

    it("throws on unknown preset", () => {
      expect(() => presetFromString("unknown")).to.throw("Unknown preset");
      expect(() => presetFromString("sss4")).to.throw("Unknown preset");
    });
  });

  describe("presetToString", () => {
    it("formats preset names", () => {
      expect(presetToString(Preset.Minimal)).to.include("Minimal");
      expect(presetToString(Preset.Compliant)).to.include("Compliant");
      expect(presetToString(Preset.Private)).to.include("Private");
    });

    it("handles unknown preset", () => {
      expect(presetToString(99 as Preset)).to.include("Unknown");
    });
  });

  describe("validatePreset", () => {
    it("validates valid presets", () => {
      expect(validatePreset(1)).to.equal(Preset.Minimal);
      expect(validatePreset(2)).to.equal(Preset.Compliant);
      expect(validatePreset(3)).to.equal(Preset.Private);
    });

    it("rejects invalid values", () => {
      expect(() => validatePreset(0)).to.throw("Invalid preset");
      expect(() => validatePreset(4)).to.throw("Invalid preset");
      expect(() => validatePreset(-1)).to.throw("Invalid preset");
    });
  });

  describe("preset feature checks", () => {
    it("SSS-1 does not require hook program", () => {
      expect(presetRequiresHookProgram(Preset.Minimal)).to.be.false;
    });

    it("SSS-2 requires hook program", () => {
      expect(presetRequiresHookProgram(Preset.Compliant)).to.be.true;
    });

    it("SSS-1 does not support permanent delegate", () => {
      expect(presetSupportsPermanentDelegate(Preset.Minimal)).to.be.false;
    });

    it("SSS-2 supports permanent delegate", () => {
      expect(presetSupportsPermanentDelegate(Preset.Compliant)).to.be.true;
    });

    it("SSS-1 and SSS-2 do not support confidential transfers", () => {
      expect(presetSupportsConfidentialTransfers(Preset.Minimal)).to.be.false;
      expect(presetSupportsConfidentialTransfers(Preset.Compliant)).to.be.false;
    });

    it("SSS-3 supports confidential transfers", () => {
      expect(presetSupportsConfidentialTransfers(Preset.Private)).to.be.true;
    });
  });
});
