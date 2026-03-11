import { expect } from "chai";
import { BN } from "@coral-xyz/anchor";
import {
  generateRangeProof,
  generateEqualityProof,
  verifyRangeProof,
} from "../src/proofs";

describe("ZK Proof Stubs", () => {
  describe("generateRangeProof", () => {
    it("throws an error indicating the function is not yet implemented", () => {
      expect(() => generateRangeProof(new BN(100), 64)).to.throw(Error);
    });

    it("throws an error message that mentions ZK proofs", () => {
      let caught: Error | undefined;
      try {
        generateRangeProof(new BN(1000), 64);
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught!.message.toLowerCase()).to.include("zk proof");
    });

    it("throws an error message that mentions 'not yet implemented'", () => {
      let caught: Error | undefined;
      try {
        generateRangeProof(new BN(0), 64);
      } catch (e) {
        caught = e as Error;
      }
      expect(caught!.message.toLowerCase()).to.include("not yet implemented");
    });

    it("throws consistently for any valid input parameters", () => {
      const inputs: Array<[BN, number]> = [
        [new BN(0), 16],
        [new BN(1), 32],
        [new BN(999999), 64],
        [new BN("18446744073709551615"), 64], // u64::MAX
      ];
      for (const [amount, bits] of inputs) {
        expect(() => generateRangeProof(amount, bits)).to.throw(Error);
      }
    });
  });

  describe("generateEqualityProof", () => {
    it("throws an error indicating the function is not yet implemented", () => {
      expect(() => generateEqualityProof(new BN(500))).to.throw(Error);
    });

    it("throws an error message that mentions ZK proofs", () => {
      let caught: Error | undefined;
      try {
        generateEqualityProof(new BN(42));
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught!.message.toLowerCase()).to.include("zk proof");
    });

    it("throws an error message that mentions 'not yet implemented'", () => {
      let caught: Error | undefined;
      try {
        generateEqualityProof(new BN(1));
      } catch (e) {
        caught = e as Error;
      }
      expect(caught!.message.toLowerCase()).to.include("not yet implemented");
    });

    it("throws consistently for any amount", () => {
      const amounts = [new BN(0), new BN(1), new BN(1_000_000)];
      for (const amount of amounts) {
        expect(() => generateEqualityProof(amount)).to.throw(Error);
      }
    });
  });

  describe("verifyRangeProof", () => {
    it("throws an error indicating the function is not yet implemented", () => {
      const dummyProof = Buffer.alloc(128, 0);
      expect(() => verifyRangeProof(dummyProof)).to.throw(Error);
    });

    it("throws an error message that mentions ZK proofs", () => {
      let caught: Error | undefined;
      try {
        verifyRangeProof(Buffer.alloc(64, 0xff));
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).to.be.instanceOf(Error);
      expect(caught!.message.toLowerCase()).to.include("zk proof");
    });

    it("throws an error message that mentions 'not yet implemented'", () => {
      let caught: Error | undefined;
      try {
        verifyRangeProof(Buffer.from("deadbeef", "hex"));
      } catch (e) {
        caught = e as Error;
      }
      expect(caught!.message.toLowerCase()).to.include("not yet implemented");
    });

    it("throws for an empty proof buffer", () => {
      expect(() => verifyRangeProof(Buffer.alloc(0))).to.throw(Error);
    });

    it("throws for a non-empty proof buffer", () => {
      expect(() => verifyRangeProof(Buffer.alloc(512, 1))).to.throw(Error);
    });
  });
});
