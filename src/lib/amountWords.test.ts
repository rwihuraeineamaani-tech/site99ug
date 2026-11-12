import { describe, expect, it } from "vitest";
import { amountInWords } from "./amountWords";

describe("amountInWords", () => {
  it("spells a retainer", () => {
    expect(amountInWords(1500000)).toBe("One million five hundred thousand Uganda shillings only");
  });
  it("handles tens and hundreds", () => {
    expect(amountInWords(114000)).toBe("One hundred and fourteen thousand Uganda shillings only");
    expect(amountInWords(2_360_050)).toBe("Two million three hundred and sixty thousand fifty Uganda shillings only");
  });
  it("handles zero", () => {
    expect(amountInWords(0)).toBe("Zero Uganda shillings only");
  });
});
