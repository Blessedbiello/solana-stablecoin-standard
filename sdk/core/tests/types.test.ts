import { expect } from "chai";
import { Role, Preset, PRESET_CONFIGS } from "../src";

describe("Types", () => {
  describe("Role enum", () => {
    it("has correct values", () => {
      expect(Role.Minter).to.equal(0);
      expect(Role.Burner).to.equal(1);
      expect(Role.Blacklister).to.equal(2);
      expect(Role.Pauser).to.equal(3);
      expect(Role.Seizer).to.equal(4);
      expect(Role.FreezeAuth).to.equal(5);
    });

    it("has 6 roles", () => {
      const roles = Object.values(Role).filter(
        (v) => typeof v === "number"
      );
      expect(roles.length).to.equal(6);
    });
  });

  describe("Preset enum", () => {
    it("has correct values", () => {
      expect(Preset.Minimal).to.equal(1);
      expect(Preset.Compliant).to.equal(2);
      expect(Preset.Private).to.equal(3);
    });

    it("has 3 presets", () => {
      const presets = Object.values(Preset).filter(
        (v) => typeof v === "number"
      );
      expect(presets.length).to.equal(3);
    });
  });

  describe("PRESET_CONFIGS", () => {
    it("has config for all presets", () => {
      expect(PRESET_CONFIGS[Preset.Minimal]).to.exist;
      expect(PRESET_CONFIGS[Preset.Compliant]).to.exist;
      expect(PRESET_CONFIGS[Preset.Private]).to.exist;
    });

    it("each config has required fields", () => {
      for (const preset of [Preset.Minimal, Preset.Compliant, Preset.Private]) {
        const config = PRESET_CONFIGS[preset];
        expect(config.preset).to.equal(preset);
        expect(config).to.have.property("hasTransferHook");
        expect(config).to.have.property("hasPermanentDelegate");
        expect(config).to.have.property("hasConfidentialTransfers");
        expect(config).to.have.property("description");
        expect(config.description).to.be.a("string");
        expect(config.description.length).to.be.greaterThan(0);
      }
    });

    it("SSS-2 is a superset of SSS-1 features", () => {
      const sss1 = PRESET_CONFIGS[Preset.Minimal];
      const sss2 = PRESET_CONFIGS[Preset.Compliant];
      // SSS-2 has everything SSS-1 has plus more
      if (sss1.hasTransferHook) expect(sss2.hasTransferHook).to.be.true;
      if (sss1.hasPermanentDelegate) expect(sss2.hasPermanentDelegate).to.be.true;
    });

    it("SSS-3 is a superset of SSS-2 features", () => {
      const sss2 = PRESET_CONFIGS[Preset.Compliant];
      const sss3 = PRESET_CONFIGS[Preset.Private];
      if (sss2.hasTransferHook) expect(sss3.hasTransferHook).to.be.true;
      if (sss2.hasPermanentDelegate) expect(sss3.hasPermanentDelegate).to.be.true;
    });
  });
});
