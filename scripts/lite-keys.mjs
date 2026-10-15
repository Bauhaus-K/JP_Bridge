import crypto from "node:crypto";
const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (p) => { const h = b64({ alg: "HS256", typ: "JWT" }); const b = b64(p); return `${h}.${b}.${crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest("base64url")}`; };
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${sign({ iss: "supabase-local", role: "anon", exp })}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${sign({ iss: "supabase-local", role: "service_role", exp })}`);
