import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { PublicKey } from "@solana/web3.js";

export async function expectError(
  fn: () => Promise<any>,
  errorCode: string | number
): Promise<void> {
  try {
    await fn();
    expect.fail("Expected error but transaction succeeded");
  } catch (err: any) {
    if (err.message?.includes("Expected error but transaction succeeded")) {
      throw err;
    }
    const errMsg = err.toString();
    if (typeof errorCode === "number") {
      expect(errMsg).to.include(
        `0x${errorCode.toString(16)}`,
        `Expected error code ${errorCode} but got: ${errMsg}`
      );
    } else {
      expect(errMsg.toLowerCase()).to.include(
        errorCode.toLowerCase(),
        `Expected error "${errorCode}" but got: ${errMsg}`
      );
    }
  }
}

export async function expectSuccess(fn: () => Promise<any>): Promise<string> {
  try {
    const result = await fn();
    return result;
  } catch (err: any) {
    expect.fail(`Expected success but got error: ${err.toString()}`);
  }
}

export function expectPublicKey(actual: any, expected: PublicKey): void {
  expect(actual.toString()).to.equal(expected.toString());
}

export function expectBN(actual: any, expected: number | anchor.BN): void {
  const actualBN = new anchor.BN(actual);
  const expectedBN =
    typeof expected === "number" ? new anchor.BN(expected) : expected;
  expect(actualBN.eq(expectedBN)).to.be.true;
}
