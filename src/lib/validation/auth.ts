import { z } from "zod";

export const emailLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "올바른 이메일 주소를 입력해 주세요." }).max(254)),
});
