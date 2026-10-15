import { exportUserData } from "@/lib/account";
import { trackEvent } from "@/lib/analytics";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("로그인이 필요합니다.", { status: 401 });
  const data = await exportUserData(user.id, user.email);
  await trackEvent("account.exported");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jp-bridge-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
