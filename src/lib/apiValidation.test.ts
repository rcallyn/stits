import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "./apiValidation";

const schema = z.object({ title: z.string().min(1), count: z.number().optional() });

function jsonRequest(body: string) {
  return new Request("http://localhost/api/test", { method: "POST", body });
}

describe("parseBody", () => {
  it("returns the parsed data for a valid body", async () => {
    const result = await parseBody(jsonRequest('{"title":"a","count":2}'), schema);
    expect(result).toEqual({ ok: true, data: { title: "a", count: 2 } });
  });

  it("strips unknown keys the schema doesn't declare", async () => {
    const result = await parseBody(jsonRequest('{"title":"a","extra":1}'), schema);
    expect(result).toEqual({ ok: true, data: { title: "a" } });
  });

  it("responds 400 with 'Invalid JSON body.' for malformed JSON", async () => {
    const result = await parseBody(jsonRequest("{not json"), schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({ error: "Invalid JSON body." });
  });

  it("responds 400 with validation details when the schema fails", async () => {
    const result = await parseBody(jsonRequest('{"title":""}'), schema);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    const body = await result.response.json();
    expect(body.error).toBe("Invalid request.");
    expect(body.details.properties.title.errors.length).toBeGreaterThan(0);
  });
});
