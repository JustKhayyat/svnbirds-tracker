// pages/api/royalties/upload-url.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // auth: admin token header must match server var
    const adminHeader = req.headers["x-admin-token"] || req.headers["x_admin_token"];
    if (!adminHeader || adminHeader !== process.env.ADMIN_API_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // config
    const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "royalty";

    // quick validation
    if (!projectUrl) return res.status(500).json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL" });
    if (!serviceRole) return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" });

    // parse body
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Invalid JSON body." }); }
    }
    const { filename, contentType } = body || {};
    if (!filename || !contentType) return res.status(400).json({ error: "Missing filename or contentType" });

    // debug (non-sensitive). Remove after verification.
    console.log("upload-url debug", { bucket, projectUrlPresent: Boolean(projectUrl), hasServiceRole: Boolean(serviceRole) });

    // ensure no leading slash and do not double-encode slashes
    const safeName = String(filename).replace(/^\/+/, "");
    const safePath = encodeURIComponent(safeName);

    // call Supabase storage sign endpoint
    const signEndpoint = `${projectUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${safePath}`;

    // debug: log endpoint then call Supabase sign endpoint including contentType
    console.log("upload-url signEndpoint", signEndpoint);

    const signResp = await fetch(signEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
      },
      body: JSON.stringify({ expiresIn: 3600, contentType }),
    });

    // capture raw response for debugging
    const signText = await signResp.text();
    console.log("upload-url signRespStatus", signResp.status);
    console.log("upload-url signRespBody", signText);

    let signJson;
    try { signJson = JSON.parse(signText); } catch (e) { signJson = signText; }

    if (!signResp.ok) {
      return res.status(502).json({ error: "Supabase sign error", status: signResp.status, detail: signJson });
    }

    // preserve shape: return signed url and object key if present
    return res.status(200).json(signJson);
  } catch (err) {
    console.error("upload-url error", err);
    return res.status(500).json({ error: "Internal error", message: err.message || String(err) });
  }
}
