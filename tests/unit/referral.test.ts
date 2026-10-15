import { describe, expect, it } from "vitest";

import {
  REFERRAL_CONSENT_TEMPLATE,
  REFERRAL_CONSENT_VERSION,
  REFERRAL_PURPOSE,
  REFERRAL_RETENTION,
  renderConsentText,
} from "@/content/consent/referral";
import { visibleFeatures } from "@/lib/features";
import { decodeItem, describeItems, encodeItem, PROFILE_ITEM_LABEL } from "@/lib/referral/items";

const ID = "11111111-2222-4333-8444-555555555555";

describe("shared items", () => {
  it("round-trips encoded items and rejects malformed values", () => {
    for (const item of [
      { kind: "profile" as const },
      { kind: "es" as const, id: ID },
      { kind: "career" as const, id: ID },
    ]) {
      expect(decodeItem(encodeItem(item))).toEqual(item);
    }
    expect(decodeItem("es:not-a-uuid")).toBeNull();
    expect(decodeItem("episodes:" + ID)).toBeNull();
    expect(decodeItem("")).toBeNull();
  });

  it("describes items for the consent text", () => {
    const text = describeItems([{ kind: "profile" }, { kind: "es", id: ID }], {
      [`es:${ID}`]: "志望動機",
    });
    expect(text).toBe(`${PROFILE_ITEM_LABEL}, ES 최신 버전 「志望動機」`);
  });
});

describe("referral consent text", () => {
  const vars = {
    partner_name: "Bridge Career KK",
    partner_country: "일본",
    partner_contact: "p@example.jp",
    partner_license: "13-ユ-000000",
    partner_privacy_contact: "privacy@example.jp",
    items: PROFILE_ITEM_LABEL,
  };

  it("fills every placeholder and includes required notice items", () => {
    const text = renderConsentText(vars);
    expect(text).not.toMatch(/\{\{\w+\}\}/);
    for (const required of [
      "제공받는 자: Bridge Career KK",
      "소재 국가: 일본",
      "허가번호: 13-ユ-000000",
      REFERRAL_PURPOSE,
      REFERRAL_RETENTION,
      "국외 이전 방법·시기",
      "동의를 거부할 권리",
      "철회 방법",
      REFERRAL_CONSENT_VERSION,
    ]) {
      expect(text).toContain(required);
    }
  });

  it("is deterministic so the server-side hash matches what the user saw", () => {
    expect(renderConsentText(vars)).toBe(renderConsentText({ ...vars }));
    expect(REFERRAL_CONSENT_TEMPLATE).toContain("{{items}}");
  });
});

describe("feature flag visibility", () => {
  it("hides referrals unless the flag is on", () => {
    expect(visibleFeatures({ referral: false }).some((f) => f.key === "referrals")).toBe(false);
    expect(visibleFeatures({ referral: true }).some((f) => f.key === "referrals")).toBe(true);
  });
});
