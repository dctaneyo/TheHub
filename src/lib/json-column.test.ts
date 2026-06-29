import { describe, it, expect } from "vitest";
import { parseJsonColumn } from "./json-column";

describe("parseJsonColumn", () => {
  it("parses valid JSON", () => {
    expect(parseJsonColumn('["a","b"]', [])).toEqual(["a", "b"]);
    expect(parseJsonColumn('{"x":1}', {})).toEqual({ x: 1 });
  });

  it("returns the fallback for null/undefined/empty string", () => {
    expect(parseJsonColumn(null, [])).toEqual([]);
    expect(parseJsonColumn(undefined, [])).toEqual([]);
    expect(parseJsonColumn("", { a: 1 })).toEqual({ a: 1 });
  });

  it("returns the fallback (not throws) on malformed JSON", () => {
    expect(parseJsonColumn("not json", [])).toEqual([]);
    expect(parseJsonColumn("{broken", null)).toBeNull();
  });

  it("supports a null fallback for nullable columns", () => {
    expect(parseJsonColumn(null, null)).toBeNull();
    expect(parseJsonColumn('["x"]', null)).toEqual(["x"]);
  });
});
