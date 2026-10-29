import { describe, expect, it } from "vitest";
import { CONNECT_STYTCH, stytchConfig } from "@/api/lib/stytch.ts";

// The Stytch project from the Worker's two optional secrets (apps/web/api/lib/stytch.ts).
describe("the Stytch project (apps/web/api/lib/stytch.ts)", () => {
  it("is connected with both the project id and the domain", () => {
    expect(stytchConfig({ STYTCH_PROJECT_ID: "project-test-1", STYTCH_DOMAIN: "acme.customers.stytch.dev" })).toEqual({
      projectId: "project-test-1",
      domain: "acme.customers.stytch.dev",
    });
  });

  it("is not connected with either one alone, or blank", () => {
    expect(stytchConfig({})).toBeNull();
    expect(stytchConfig({ STYTCH_PROJECT_ID: "project-test-1" })).toBeNull();
    expect(stytchConfig({ STYTCH_DOMAIN: "acme.customers.stytch.dev" })).toBeNull();
    expect(stytchConfig({ STYTCH_PROJECT_ID: "  ", STYTCH_DOMAIN: "acme.customers.stytch.dev" })).toBeNull();
  });

  it("reads a domain pasted as a URL as its host, and trims both", () => {
    expect(
      stytchConfig({ STYTCH_PROJECT_ID: " project-test-1 ", STYTCH_DOMAIN: "https://acme.customers.stytch.dev/" }),
    ).toEqual({ projectId: "project-test-1", domain: "acme.customers.stytch.dev" });
  });

  it("names the step while it is not connected", () => {
    expect(CONNECT_STYTCH).toBe("connect Stytch");
  });
});
