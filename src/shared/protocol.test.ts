import { describe, expect, it } from "vitest";
import { isNativeReply, isToggleProxyCommand, POPUP_PORT_NAME } from "./protocol";

describe("isToggleProxyCommand", () => {
  it("accepts the toggle command", () => {
    expect(isToggleProxyCommand({ command: "toggleProxy" })).toBe(true);
  });

  it.each([null, undefined, "toggleProxy", 1, {}, { command: "other" }])(
    "rejects %o",
    (value) => {
      expect(isToggleProxyCommand(value)).toBe(false);
    },
  );
});

describe("isNativeReply", () => {
  it("accepts objects", () => {
    expect(isNativeReply({ procRunning: { port: 1, pid: 2, error: "" } })).toBe(true);
    expect(isNativeReply({})).toBe(true);
  });

  it.each([null, undefined, "x", 3, []])("rejects %o", (value) => {
    expect(isNativeReply(value)).toBe(false);
  });
});

it("uses the legacy popup port name", () => {
  expect(POPUP_PORT_NAME).toBe("popup");
});
