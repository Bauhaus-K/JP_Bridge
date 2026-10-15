import "server-only";

import { serverEnv } from "@/lib/env";

export const flags = {
  /** 제휴 인재소개사 리퍼럴 (M9). 기본 OFF. */
  referral: () => serverEnv().FEATURE_REFERRAL,
};
