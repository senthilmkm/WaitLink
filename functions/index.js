const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

let localSecrets = {};
try {
  localSecrets = require("./secrets.json");
} catch (e) {
  try {
    localSecrets = require("../stripe_credentials.json");
  } catch (e2) {}
}

const BREVO_API_KEY = process.env.BREVO_API_KEY || localSecrets.brevo_api_key || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || localSecrets.resend_api_key || "";
const SENDER_EMAIL = process.env.SENDER_EMAIL || localSecrets.sender_email || "senthil930@gmail.com";
const RESEND_SENDER = "WaitLink Security <onboarding@resend.dev>";
const SENDER_NAME = "WaitLink Security";

/**
 * Unified Transactional Email Dispatcher (Primary: Brevo REST API, Fallback: Resend)
 */
async function dispatchEmail({ to, subject, html, text }) {
  const recipient = Array.isArray(to) ? to : [to];
  const cleanTo = recipient.map(t => typeof t === "string" ? { email: t.trim().toLowerCase() } : t);

  let brevoDebug = null;
  let resendDebug = null;

  // 1. Primary: Brevo REST API
  if (BREVO_API_KEY) {
    try {
      const brevoPayload = {
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: cleanTo,
        subject: subject,
        htmlContent: html,
        textContent: text || ""
      };

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY.trim(),
          "Content-Type": "application/json",
          "accept": "application/json",
          "User-Agent": "WaitLink/1.0"
        },
        body: JSON.stringify(brevoPayload)
      });

      let brevoData = null;
      try {
        brevoData = await brevoRes.json();
      } catch (e) {
        brevoData = { parseError: e.message };
      }
      brevoDebug = { status: brevoRes.status, data: brevoData };
      
      if (brevoRes.ok && (brevoData.messageId || brevoData.id)) {
        logger.info(`Email dispatched successfully via Brevo to ${cleanTo.map(c => c.email).join(", ")}. MessageId: ${brevoData.messageId || brevoData.id}`);
        return {
          success: true,
          provider: "brevo",
          messageId: brevoData.messageId || brevoData.id
        };
      } else {
        logger.warn("Brevo API did not succeed, attempting Resend fallback:", { status: brevoRes.status, data: brevoData, keyStart: BREVO_API_KEY.substring(0, 16) });
      }
    } catch (brevoErr) {
      brevoDebug = { error: brevoErr.message };
      logger.warn("Brevo API error, attempting Resend fallback:", brevoErr);
    }
  }

  // 2. Secondary Fallback: Resend REST API
  if (RESEND_API_KEY) {
    try {
      const resendPayload = {
        from: RESEND_SENDER,
        to: cleanTo.map(c => c.email),
        subject: subject,
        html: html,
        text: text || ""
      };

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY.trim()}`,
          "Content-Type": "application/json",
          "User-Agent": "WaitLink/1.0"
        },
        body: JSON.stringify(resendPayload)
      });

      let resendData = null;
      try {
        resendData = await resendRes.json();
      } catch (e) {
        resendData = { parseError: e.message };
      }
      resendDebug = { status: resendRes.status, data: resendData };

      if (resendRes.ok && resendData.id) {
        logger.info(`Email dispatched successfully via Resend fallback to ${cleanTo.map(c => c.email).join(", ")}`);
        return {
          success: true,
          provider: "resend",
          messageId: resendData.id
        };
      } else {
        logger.warn("Resend API fallback rejected:", resendData);
      }
    } catch (resendErr) {
      resendDebug = { error: resendErr.message };
      logger.error("Resend API fallback error:", resendErr);
    }
  }

  return {
    success: false,
    error: "Failed to dispatch email via transactional email services (Brevo / Resend).",
    details: { brevo: brevoDebug, resend: resendDebug }
  };
}

/**
 * Cloud Function: sendBrevoPasswordReset
 * Generates a secure Firebase Auth password reset link and dispatches
 * a luxury branded HTML email via the Brevo REST API.
 */
exports.sendBrevoPasswordReset = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const { email } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Verify user exists in Firebase Auth
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(cleanEmail);
      } catch (userErr) {
        if (userErr.code === "auth/user-not-found") {
          logger.info(`Password reset requested for non-existent email: ${cleanEmail}`);
          return res.status(200).json({
            success: true,
            message: "If an account exists with this email, a reset link has been sent."
          });
        }
        throw userErr;
      }

      // 2. Generate secure one-time Firebase Auth password reset link
      const actionCodeSettings = {
        url: "https://waitlink.app/index.html",
        handleCodeInApp: true
      };

      const rawResetLink = await admin.auth().generatePasswordResetLink(cleanEmail, actionCodeSettings);
      logger.info(`Generated raw password reset link for: ${cleanEmail}`);

      let resetLink = rawResetLink;
      try {
        const parsedUrl = new URL(rawResetLink);
        const oobCode = parsedUrl.searchParams.get("oobCode");
        const apiKey = parsedUrl.searchParams.get("apiKey");

        let hostOrigin = "https://waitlink.app";
        if (req.body && req.body.origin && typeof req.body.origin === "string" && (req.body.origin.includes("localhost") || req.body.origin.includes("127.0.0.1"))) {
          hostOrigin = req.body.origin.replace(/\/+$/, "");
        }

        if (oobCode) {
          resetLink = `${hostOrigin}/reset-password.html?oobCode=${encodeURIComponent(oobCode)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ""}`;
          logger.info(`Formatted canonical branded reset link: ${resetLink}`);
        }
      } catch (parseErr) {
        logger.warn("Could not parse raw reset link URL, using raw link:", parseErr);
      }

      // 3. Compose luxury branded HTML email template
      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your WaitLink Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, rgba(15, 23, 42, 0) 100%);">
              <div style="display: inline-block; margin-bottom: 12px;">
                <span style="font-size: 32px; line-height: 1;">⚡</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
                Wait<span style="color: #06b6d4;">Link</span>
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                Live Walk-In Wait Time Tracker
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #f8fafc;">
                Reset Your Password
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">Hello,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                We received a request to reset the password for your WaitLink account (<strong style="color: #38bdf8;">${cleanEmail}</strong>). Click the button below to choose a new password:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 9999px; box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4); text-align: center; letter-spacing: 0.01em;">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background: rgba(6, 182, 212, 0.06); border-left: 3px solid #06b6d4; border-radius: 8px; padding: 14px 16px; margin: 24px 0 20px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #94a3b8;">
                  ⏱️ <strong style="color: #e2e8f0;">Security Notice:</strong> This reset link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your account remains completely secure.
                </p>
              </div>
              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b; word-break: break-all;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${resetLink}" style="color: #38bdf8; text-decoration: underline;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">
                WaitLink Platform Security &bull; <a href="https://waitlink.app" style="color: #06b6d4; text-decoration: none;">waitlink.app</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                Need help? Contact us at <a href="mailto:support@waitlink.app" style="color: #94a3b8; text-decoration: none;">support@waitlink.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const textContent = `Reset Your WaitLink Password\n\nHello,\n\nWe received a request to reset the password for your WaitLink account (${cleanEmail}).\n\nReset your password using this link:\n${resetLink}\n\nSecurity Notice: This link expires in 1 hour. If you did not request this, you can safely ignore this message.\n\nWaitLink Team\nhttps://waitlink.app`;

      // 4. Dispatch via Primary Brevo REST API (with automatic Resend fallback)
      const dispatchResult = await dispatchEmail({
        to: cleanEmail,
        subject: "🔐 Reset your WaitLink password",
        html: emailHtml,
        text: textContent
      });

      if (!dispatchResult.success) {
        return res.status(500).json({
          error: dispatchResult.error || "Failed to dispatch password reset email."
        });
      }

      return res.status(200).json({
        success: true,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId,
        message: `Branded password reset email dispatched via ${dispatchResult.provider} successfully.`
      });

    } catch (err) {
      logger.error("Error generating or sending password reset email:", err);
      return res.status(500).json({
        error: "Failed to process password reset request: " + (err.message || err.code || "Internal error")
      });
    }
  });
});

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || localSecrets.twilio_account_sid || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || localSecrets.twilio_auth_token || "";
const TWILIO_FROM_PHONE = process.env.TWILIO_FROM_PHONE || localSecrets.twilio_from_phone || "+18039027464";

const TOPUP_MICRO_PRICE_ID = process.env.TOPUP_MICRO_PRICE_ID || localSecrets.topup_micro_price_id || "price_1URHUhHXdog2I9XKyYLKFxLM";
const TOPUP_GROWTH_PRICE_ID = process.env.TOPUP_GROWTH_PRICE_ID || localSecrets.topup_growth_price_id || "price_1URHVaHXdog2I9XKypqiBnDf";
const TOPUP_POWER_PRICE_ID = process.env.TOPUP_POWER_PRICE_ID || localSecrets.topup_power_price_id || "price_1URHW8HXdog2I9XK0vb6CJXN";

// Rate limiting map for SMS: slug -> array of timestamps
const smsRateLimitMap = new Map();
function checkSmsRateLimit(slug) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxPerWindow = 10;
  const timestamps = (smsRateLimitMap.get(slug) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxPerWindow) {
    return false;
  }
  timestamps.push(now);
  smsRateLimitMap.set(slug, timestamps);
  return true;
}

/**
 * Calculates SMS carrier segments based on GSM-7 vs UCS-2 encoding.
 * GSM-7: 160 chars max for 1 segment; 153 chars/segment for multi-segment.
 * UCS-2 (Emojis/Unicode): 70 chars max for 1 segment; 67 chars/segment for multi-segment.
 */
function calculateSmsSegments(text) {
  if (!text || typeof text !== "string") return 1;
  const gsmRegex = /^[@£$¥èéùìòÇ\r\nØøÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~\]|€]*$/;
  const isGsm = gsmRegex.test(text);
  const len = text.length;
  if (isGsm) {
    if (len <= 160) return 1;
    return Math.ceil(len / 153);
  } else {
    if (len <= 70) return 1;
    return Math.ceil(len / 67);
  }
}

/**
 * Retrieves or initializes shop SMS usage wallet with billing cycle rollover logic.
 */
async function getOrInitSmsUsage(slug, shopData) {
  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const usageRef = admin.firestore().collection("shops").doc(slug).collection("billing").doc("smsUsage");
  const snap = await usageRef.get();
  
  const planPrice = shopData && shopData.planPrice !== undefined && shopData.planPrice !== null ? Number(shopData.planPrice) : 0;
  const subscriptionStatus = String((shopData && shopData.subscriptionStatus) || "").toLowerCase();
  const isEnterprise = planPrice >= 49;
  const isPro = planPrice >= 15 || subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const baseMonthlyQuota = (shopData && shopData.customMonthlyQuota !== undefined && shopData.customMonthlyQuota !== null && !isNaN(parseInt(shopData.customMonthlyQuota, 10)))
    ? parseInt(shopData.customMonthlyQuota, 10)
    : (isEnterprise ? 2500 : (isPro ? 500 : 0));

  let usage = snap.exists ? snap.data() : null;

  if (!usage) {
    usage = {
      monthlyAllowance: baseMonthlyQuota,
      baseMonthlyQuota: baseMonthlyQuota,
      rolledOverFromPriorMonth: 0,
      monthlyUsed: 0,
      topUpBalance: 0,
      totalAvailable: baseMonthlyQuota,
      billingCycleStart: now,
      billingCycleEnd: now + monthMs,
      lastResetAt: now,
      lifetimeSent: 0,
      lastAlertThreshold: 0,
      recentDispatches: []
    };
    await usageRef.set(usage);
    return { usage, ref: usageRef };
  }

  // Detect and handle mid-cycle subscription tier switches (e.g. Pro <-> Enterprise)
  const currentBase = usage.baseMonthlyQuota || (usage.monthlyAllowance > 1000 ? 2500 : (usage.monthlyAllowance > 0 ? 500 : 0));
  if (currentBase !== baseMonthlyQuota) {
    logger.info(`Detected tier plan change for ${slug}: base quota changing from ${currentBase} to ${baseMonthlyQuota}`);
    const delta = baseMonthlyQuota - currentBase;
    if (delta > 0) {
      // Upgrade (e.g. Pro 500 -> Enterprise 2500): grant the delta (+2,000) immediately
      usage.monthlyAllowance = (usage.monthlyAllowance || currentBase) + delta;
    } else {
      // Downgrade (e.g. Enterprise 2500 -> Pro 500): cap allowance at new tier limit
      usage.monthlyAllowance = Math.min(baseMonthlyQuota, usage.monthlyAllowance || baseMonthlyQuota);
    }
    usage.baseMonthlyQuota = baseMonthlyQuota;
    usage.tierPrice = planPrice;
    usage.tierTitle = shopData.planTitle || (isEnterprise ? "Enterprise Tier" : "Pro Business Tier");
    usage.totalAvailable = Math.max(0, (usage.monthlyAllowance || baseMonthlyQuota) - (usage.monthlyUsed || 0)) + (usage.topUpBalance || 0);
    usage.updatedAt = now;
    await usageRef.set(usage, { merge: true });
  }

  // Check if billing cycle has expired -> perform rollover
  if (now >= (usage.billingCycleEnd || (now + monthMs))) {
    // Fetch system rollover policy from settings/pricing_config
    let rolloverPolicy = "option_b";
    try {
      const configDoc = await admin.firestore().collection("settings").doc("pricing_config").get();
      if (configDoc.exists && configDoc.data().rolloverPolicy) {
        rolloverPolicy = configDoc.data().rolloverPolicy;
      }
    } catch (e) {
      logger.warn("Could not fetch pricing_config rolloverPolicy, defaulting to option_b:", e.message);
    }

    if (rolloverPolicy === "option_b") {
      const unspent = Math.max(0, (usage.monthlyAllowance || baseMonthlyQuota) - (usage.monthlyUsed || 0));
      const rolledOver = Math.min(baseMonthlyQuota, unspent);
      usage.monthlyAllowance = baseMonthlyQuota + rolledOver;
      usage.rolledOverFromPriorMonth = rolledOver;
    } else {
      usage.monthlyAllowance = baseMonthlyQuota;
      usage.rolledOverFromPriorMonth = 0;
    }

    usage.baseMonthlyQuota = baseMonthlyQuota;
    usage.monthlyUsed = 0;
    usage.billingCycleStart = now;
    usage.billingCycleEnd = now + monthMs;
    usage.lastResetAt = now;
    usage.lastAlertThreshold = 0;
    usage.totalAvailable = Math.max(0, usage.monthlyAllowance) + (usage.topUpBalance || 0);
    usage.updatedAt = now;

    await usageRef.set(usage, { merge: true });
  } else {
    // Recompute totalAvailable to ensure consistency
    usage.totalAvailable = Math.max(0, (usage.monthlyAllowance || baseMonthlyQuota) - (usage.monthlyUsed || 0)) + (usage.topUpBalance || 0);
  }

  return { usage, ref: usageRef };
}

/**
 * Checks and dispatches 80% or 100% capacity warning transactional emails.
 */
async function checkAndSendCapacityAlerts(slug, shopData, usage) {
  const ownerEmail = (shopData && shopData.ownerEmail) ? shopData.ownerEmail : "";
  if (!ownerEmail) return;
  const shopName = (shopData && shopData.shopName) || slug;
  const monthlyAllowance = usage.monthlyAllowance || 500;
  const monthlyUsed = usage.monthlyUsed || 0;
  const topUpBalance = usage.topUpBalance || 0;
  const pct = (monthlyUsed / monthlyAllowance) * 100;
  const topUpUrl = `https://waitlink.app?s=${slug}&view=owner&tab=notifications`;

  if (usage.totalAvailable <= 0 && (!usage.lastAlertThreshold || usage.lastAlertThreshold < 100)) {
    usage.lastAlertThreshold = 100;
    const subject = `⚠️ SMS Alerts Paused for ${shopName} (100% Quota Reached)`;
    const html = `<!DOCTYPE html><html><body style="background:#080d1a;color:#f1f5f9;font-family:sans-serif;padding:30px;">
      <div style="max-width:560px;margin:auto;background:#0f172a;border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;">
        <h2 style="color:#ef4444;margin-top:0;">⚠️ Outbound SMS Alerts Paused</h2>
        <p>Your shop <strong>${shopName}</strong> has reached 100% of its monthly SMS quota (<strong>${monthlyUsed}/${monthlyAllowance}</strong> used).</p>
        <p style="color:#cbd5e1;">In-lobby screen calling continues normally, but cellular SMS text alerts to customer phones are temporarily paused until your next billing cycle or until you add top-up credits.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${topUpUrl}" style="background:#10b981;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">⚡ Add SMS Top-Up Credits (From $5) &rarr;</a>
        </div>
        <p style="font-size:12px;color:#94a3b8;">Top-up credits never expire and roll over indefinitely.</p>
      </div></body></html>`;
    await dispatchEmail({ to: ownerEmail, subject, html, text: `SMS alerts paused for ${shopName}. 100% quota used. Add top-up credits at: ${topUpUrl}` }).catch(console.warn);
  } else if (pct >= 80 && topUpBalance <= 0 && (!usage.lastAlertThreshold || usage.lastAlertThreshold < 80)) {
    usage.lastAlertThreshold = 80;
    const subject = `⚠️ 80% SMS Quota Warning for ${shopName}`;
    const html = `<!DOCTYPE html><html><body style="background:#080d1a;color:#f1f5f9;font-family:sans-serif;padding:30px;">
      <div style="max-width:560px;margin:auto;background:#0f172a;border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:24px;">
        <h2 style="color:#f59e0b;margin-top:0;">⚠️ 80% SMS Capacity Reached</h2>
        <p>Your shop <strong>${shopName}</strong> has used <strong>${monthlyUsed} of ${monthlyAllowance}</strong> included monthly SMS credits (80%).</p>
        <p style="color:#cbd5e1;">To avoid any disruption during peak rush hours, you can add top-up credits that never expire.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${topUpUrl}" style="background:#06b6d4;color:#fff;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">⚡ View Top-Up Packs &rarr;</a>
        </div>
      </div></body></html>`;
    await dispatchEmail({ to: ownerEmail, subject, html, text: `80% SMS capacity reached for ${shopName}. View top-up packs at: ${topUpUrl}` }).catch(console.warn);
  }
}

/**
 * Cloud Function: sendTwilioSms
 * Dispatches SMS via Twilio REST API server-side.
 * Strictly requires Firebase Auth, verifies shop ownership, enforces SMS quota limits,
 * debits carrier segments accurately, and records audit logs.
 */
exports.sendTwilioSms = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    // Firebase ID token only. A passcode hash sent by the browser is not a credential.
    const authHeader = req.headers.authorization || "";
    let decodedToken = null;

    if (authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1].trim();
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (authErr) {
        logger.warn("Twilio SMS bearer token error:", authErr.message);
      }
    }

    const { to, body, from, slug } = req.body || {};
    const cleanSlug = String(slug || "main-st-barbers").trim().toLowerCase();
    const isStaffAuthenticated = !!(
      decodedToken
      && decodedToken.role === "staff"
      && decodedToken.shopSlug === cleanSlug
    );

    if (!decodedToken) {
      return res.status(401).json({ success: false, error: "Authentication required to dispatch SMS. Please sign in as Owner or use active Front Desk Staff Station credentials." });
    }

    if (!to || !body) {
      return res.status(400).json({ success: false, error: "Parameters 'to' and 'body' are required." });
    }

    const targetTo = to.trim();
    const senderFrom = (from && typeof from === "string" && from.trim()) ? from.trim() : TWILIO_FROM_PHONE;
    const messageBody = body.trim();
    const neededSegments = calculateSmsSegments(messageBody);

    // 2. Verify Shop Ownership / Staff Authorization and Tier
    const callerEmail = decodedToken ? (decodedToken.email || "").toLowerCase() : "";
    const isSuper = decodedToken && (callerEmail === SENDER_EMAIL.toLowerCase() || callerEmail === "senthil930@gmail.com");

    const shopDoc = await admin.firestore().collection("shops").doc(cleanSlug).get();
    if (!shopDoc.exists) {
      return res.status(404).json({ success: false, error: "Shop not found." });
    }
    const shopData = shopDoc.data() || {};

    if (!isSuper) {
      if (!isStaffAuthenticated) {
        const isOwner = (shopData.ownerEmail && shopData.ownerEmail.toLowerCase() === callerEmail) ||
                        (shopData.ownerUid && shopData.ownerUid === decodedToken.uid);

        if (!isOwner) {
          return res.status(403).json({ success: false, error: "Forbidden: You are not authorized to send SMS for this shop." });
        }
      }

      if (!shopIsPaid(shopData)) {
        return res.status(403).json({
          success: false,
          tierUpgradeRequired: true,
          error: "Automated SMS alerts require an active Pro Business ($15/mo) or Enterprise plan. Upgrade to unlock automated SMS."
        });
      }
    }

    // 3. Rate Limit per shop (Anti-Spam)
    if (!checkSmsRateLimit(cleanSlug)) {
      return res.status(429).json({ success: false, error: "SMS dispatch rate limit exceeded (maximum 10 per minute)." });
    }

    // 4. Quota Enforcement & Wallet Inspection
    const { usage: usageData, ref: usageRef } = await getOrInitSmsUsage(cleanSlug, shopData);
    const availablePlan = Math.max(0, (usageData.monthlyAllowance || 500) - (usageData.monthlyUsed || 0));
    const totalAvailable = availablePlan + (usageData.topUpBalance || 0);

    if (!isSuper && totalAvailable < neededSegments) {
      await checkAndSendCapacityAlerts(cleanSlug, shopData, usageData);
      await usageRef.set(usageData, { merge: true });
      return res.status(402).json({
        success: false,
        quotaExhausted: true,
        error: "SMS Quota Exhausted: Your shop has 0 available SMS credits. Please top up your balance in Owner Settings to resume automated text alerts.",
        totalAvailable: totalAvailable,
        neededSegments: neededSegments
      });
    }

    const activeSid = TWILIO_ACCOUNT_SID;
    const activeToken = TWILIO_AUTH_TOKEN;
    const callerLabel = isStaffAuthenticated ? `staff:${decodedToken.staffId || "desk"}` : (callerEmail || "owner");

    try {
      const auth = Buffer.from(`${activeSid}:${activeToken}`).toString("base64");
      const postParams = new URLSearchParams();
      postParams.append("To", targetTo);
      postParams.append("From", senderFrom);
      postParams.append("Body", messageBody);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${activeSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: postParams.toString()
        }
      );

      const data = await twilioRes.json();
      if (twilioRes.ok && data.sid) {
        logger.info(`Twilio SMS sent successfully to ${targetTo}! SID: ${data.sid}, Segments: ${neededSegments}`);

        // Debit credits accurately: plan allowance first, then top-up balance
        let bucketUsed = "Monthly Included";
        if (availablePlan >= neededSegments) {
          usageData.monthlyUsed = (usageData.monthlyUsed || 0) + neededSegments;
          bucketUsed = "Monthly Included";
        } else {
          const remainder = neededSegments - availablePlan;
          if (availablePlan > 0) {
            bucketUsed = `Split (${availablePlan} Included + ${remainder} Top-Up)`;
          } else {
            bucketUsed = "Top-Up Reserve";
          }
          usageData.monthlyUsed = usageData.monthlyAllowance || 500;
          usageData.topUpBalance = Math.max(0, (usageData.topUpBalance || 0) - remainder);
        }
        usageData.totalAvailable = Math.max(0, (usageData.monthlyAllowance || 500) - (usageData.monthlyUsed || 0)) + (usageData.topUpBalance || 0);
        usageData.lifetimeSent = (usageData.lifetimeSent || 0) + neededSegments;

        // Record in recent dispatches (keep latest 50)
        const maskedTo = targetTo.length > 7
          ? targetTo.slice(0, targetTo.length - 7) + "****" + targetTo.slice(-4)
          : targetTo;

        usageData.recentDispatches = usageData.recentDispatches || [];
        usageData.recentDispatches.unshift({
          to: maskedTo,
          segments: neededSegments,
          bucket: bucketUsed,
          sid: data.sid,
          dispatchedAt: Date.now(),
          status: data.status || "delivered",
          caller: callerLabel
        });
        if (usageData.recentDispatches.length > 50) {
          usageData.recentDispatches.length = 50;
        }

        // Check if warning alerts need to be dispatched
        await checkAndSendCapacityAlerts(cleanSlug, shopData, usageData);
        await usageRef.set(usageData, { merge: true });

        // Record delivery record in /messages collection with Admin SDK
        try {
          await admin.firestore().collection("messages").add({
            to: data.to || targetTo,
            from: data.from || senderFrom,
            body: messageBody,
            shopSlug: cleanSlug,
            sid: data.sid,
            segments: neededSegments,
            bucket: bucketUsed,
            status: data.status || "delivered",
            caller: callerLabel,
            createdAt: Date.now()
          });
        } catch (dbErr) {
          logger.warn("Message collection log note:", dbErr.message);
        }

        return res.status(200).json({
          success: true,
          sid: data.sid,
          segments: neededSegments,
          bucket: bucketUsed,
          totalAvailable: usageData.totalAvailable,
          monthlyUsed: usageData.monthlyUsed,
          monthlyAllowance: usageData.monthlyAllowance || 500,
          topUpBalance: usageData.topUpBalance || 0,
          status: data.status,
          to: data.to,
          from: data.from
        });
      } else {
        logger.warn("Twilio REST API Error (0 credits deducted):", data);
        return res.status(twilioRes.status || 400).json({
          success: false,
          error: data.message || `Twilio Error Code ${data.code}`,
          code: data.code,
          details: data
        });
      }
    } catch (err) {
      logger.error("Error dispatching Twilio SMS:", err);
      return res.status(500).json({
        success: false,
        error: "Server error dispatching Twilio SMS: " + (err.message || "Unknown error")
      });
    }
  });
});

/**
 * Cloud Function: sendShopWelcomeEmail
 * Dispatches a luxury branded HTML onboarding confirmation email containing
 * the shop's Owner Admin, Front Desk, and Public Customer Check-In links.
 */
exports.sendShopWelcomeEmail = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { shopName, slug, email, ownerUrl, deskUrl, publicUrl } = req.body || {};
    if (!email || !shopName) {
      return res.status(400).json({ success: false, error: "Parameters 'email' and 'shopName' are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanShopName = shopName.trim();
    const cleanSlug = slug || cleanShopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const cleanPublicUrl = publicUrl || `https://waitlink.app?s=${cleanSlug}&view=public`;
    const cleanDeskUrl = deskUrl || `https://waitlink.app?s=${cleanSlug}&view=desk`;
    const cleanOwnerUrl = ownerUrl || `https://waitlink.app?s=${cleanSlug}&view=owner`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cleanPublicUrl)}`;

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to WaitLink - ${cleanShopName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0) 100%);">
              <span style="font-size: 36px; line-height: 1;">⚡</span>
              <h1 style="margin: 8px 0 0 0; font-size: 26px; font-weight: 800; color: #ffffff;">Wait<span style="color: #06b6d4;">Link</span></h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Live Walk-In Line Management</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 12px 16px; margin-bottom: 24px; text-align: center;">
                <span style="color: #34d399; font-weight: 700; font-size: 15px;">🎉 ${cleanShopName} is Officially Live!</span>
              </div>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">Hello,</p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
                Congratulations on setting up <strong style="color: #38bdf8;">${cleanShopName}</strong> on WaitLink. Your customers can now check live wait times and check in right from their smartphones.
              </p>

              <div style="margin-bottom: 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px;">
                      <strong style="color: #38bdf8; font-size: 14px;">🔑 Owner Admin Portal</strong>
                      <p style="margin: 4px 0 10px 0; font-size: 12px; color: #94a3b8;">Manage branding, promo offers, wait time baseline, and staff.</p>
                      <a href="${cleanOwnerUrl}" target="_blank" style="display: inline-block; background: #06b6d4; color: #fff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 6px;">Open Admin &rarr;</a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px;">
                      <strong style="color: #34d399; font-size: 14px;">💈 Front Desk Controller</strong>
                      <p style="margin: 4px 0 10px 0; font-size: 12px; color: #94a3b8;">Keep open on your reception counter tablet or desktop to call and serve customers.</p>
                      <a href="${cleanDeskUrl}" target="_blank" style="display: inline-block; background: #10b981; color: #fff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 6px;">Open Desk Panel &rarr;</a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;">
                  <tr>
                    <td style="padding: 16px;">
                      <strong style="color: #a78bfa; font-size: 14px;">📱 Customer Live Check-In Page</strong>
                      <p style="margin: 4px 0 10px 0; font-size: 12px; color: #94a3b8;">Share this link with your customers or on social media.</p>
                      <a href="${cleanPublicUrl}" target="_blank" style="display: inline-block; background: #8b5cf6; color: #fff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 6px;">View Customer Page &rarr;</a>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background: rgba(6, 182, 212, 0.06); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #e2e8f0;">📱 Your Front Desk Customer QR Code</p>
                <img src="${qrUrl}" alt="Customer QR Code" width="160" height="160" style="display: block; margin: 0 auto; border-radius: 8px; background: #fff; padding: 6px;">
                <p style="margin: 12px 0 0 0; font-size: 12px; color: #94a3b8;">Print or display this at your front counter for instant customer self check-in.</p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b;">Registered Account Email: <strong style="color: #94a3b8;">${cleanEmail}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background: rgba(0, 0, 0, 0.25); border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">WaitLink Cloud Sync &bull; <a href="https://waitlink.app" style="color: #06b6d4; text-decoration: none;">waitlink.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const textContent = `Welcome to WaitLink!\n\nCongratulations on registering ${cleanShopName}!\n\nHere are your official shop links:\n\n🔑 Owner Admin Portal:\n${cleanOwnerUrl}\n\n💈 Front Desk Controller:\n${cleanDeskUrl}\n\n📱 Customer Live Check-In Page:\n${cleanPublicUrl}\n\nRegistered Email: ${cleanEmail}\n\nhttps://waitlink.app`;

    const dispatchResult = await dispatchEmail({
      to: cleanEmail,
      subject: `🚀 Successful Registration: Welcome ${cleanShopName} to WaitLink!`,
      html: emailHtml,
      text: textContent
    });

    if (dispatchResult.success) {
      return res.status(200).json({
        success: true,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId
      });
    }

    return res.status(500).json({
      success: false,
      error: dispatchResult.error || "Failed to dispatch welcome email.",
      details: dispatchResult.details
    });
  });
});

/**
 * Cloud Function: sendContactSupportAlert
 * Dispatches an automated email notification to senthil930@gmail.com whenever
 * a visitor, shop owner, or customer submits an inquiry on contact.html.
 */
exports.sendContactSupportAlert = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { name, email, shop, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: "Name, email, and message are required." });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanShop = String(shop || "N/A").trim();
    const cleanSubject = String(subject || "Support Inquiry").trim();
    const cleanMessage = String(message).trim();

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>New Support Inquiry</title></head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        <tr>
          <td style="padding: 24px 32px; background: linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <h1 style="margin: 0; font-size: 20px; color: #ffffff;">📩 New WaitLink Support Inquiry</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">From: ${cleanName} &bull; ${cleanEmail}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; margin-bottom: 20px; font-size: 14px;">
              <tr><td style="padding: 10px 16px; color: #94a3b8; width: 100px;">Sender:</td><td style="padding: 10px 16px; color: #f8fafc; font-weight: 600;">${cleanName} (&lt;${cleanEmail}&gt;)</td></tr>
              <tr><td style="padding: 10px 16px; color: #94a3b8;">Business/Shop:</td><td style="padding: 10px 16px; color: #f8fafc;">${cleanShop}</td></tr>
              <tr><td style="padding: 10px 16px; color: #94a3b8;">Topic:</td><td style="padding: 10px 16px; color: #38bdf8; font-weight: 600;">${cleanSubject}</td></tr>
              <tr><td style="padding: 10px 16px; color: #94a3b8;">Timestamp:</td><td style="padding: 10px 16px; color: #cbd5e1;">${new Date().toLocaleString()}</td></tr>
            </table>

            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 8px 0;">Message:</h3>
            <div style="background: rgba(6, 182, 212, 0.05); border-left: 3px solid #06b6d4; padding: 14px 16px; border-radius: 6px; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${cleanMessage}</div>

            <div style="margin-top: 24px; text-align: center;">
              <a href="mailto:${cleanEmail}?subject=Re: WaitLink Inquiry - ${encodeURIComponent(cleanSubject)}" style="display: inline-block; background: #06b6d4; color: #fff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 10px 24px; border-radius: 8px;">Reply Directly to ${cleanName} &rarr;</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const dispatchResult = await dispatchEmail({
      to: "senthil930@gmail.com",
      subject: `📩 New WaitLink Inquiry: ${cleanSubject} (from ${cleanName})`,
      html: emailHtml,
      text: `New Support Inquiry\nFrom: ${cleanName} (${cleanEmail})\nShop: ${cleanShop}\nTopic: ${cleanSubject}\n\nMessage:\n${cleanMessage}`
    });

    return res.status(200).json({
      success: dispatchResult.success,
      provider: dispatchResult.provider,
      messageId: dispatchResult.messageId,
      error: dispatchResult.error
    });
  });
});

/**
 * Helper: Dispatches luxury branded subscription upgrade confirmation email.
 */
async function dispatchSubscriptionUpgradeEmailHelper({ email, shopName, planTitle, planPrice, slug }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanShop = String(shopName || "Your Shop").trim();
  const cleanPlan = String(planTitle || "Pro Business Tier").trim();
  const priceStr = planPrice !== undefined ? `$${planPrice}/mo` : "$15/mo";
  const cleanSlug = String(slug || "main-st-barbers").trim();
  const adminUrl = `https://waitlink.app?s=${cleanSlug}&view=owner`;
  const deskUrl = `https://waitlink.app?s=${cleanSlug}&view=desk`;

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>WaitLink Subscription Upgraded</title></head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        <tr>
          <td style="padding: 32px; text-align: center; background: linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span style="font-size: 36px;">💎</span>
            <h1 style="margin: 8px 0 0 0; font-size: 24px; color: #ffffff;">Subscription Confirmed!</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #10b981; font-weight: 600;">${cleanShop} is now on ${cleanPlan} (${priceStr})</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
              Thank you for upgrading! Your premium WaitLink features and monthly outbound SMS allowance are now active:
            </p>
            <ul style="font-size: 14px; line-height: 1.9; color: #e2e8f0; padding-left: 20px; margin: 0 0 24px 0;">
              <li>✓ <strong>📱 500 Outbound SMS Customer Alerts / month:</strong> Automated text alerts when staff tap "Serve Now".</li>
              <li>✓ <strong>🎁 1-Month Rollover Bank:</strong> Unused monthly SMS credits automatically roll over (up to 1,000 SMS bank).</li>
              <li>✓ <strong>⚡ SMS Top-Up Wallet:</strong> Add non-expiring credit packs anytime from $5.</li>
              <li>✓ <strong>Custom Shop Logo & Branding:</strong> Upload your logo and custom brand colors.</li>
              <li>✓ <strong>Promotional Offer Banners:</strong> Run customer promo messages on your live public status display.</li>
              <li>✓ <strong>90-Day History & RFC 4180 CSV Export:</strong> Unlimited download of queue logs and wait time metrics.</li>
            </ul>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 24px;">
              <a href="${adminUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #10b981 100%); color: #fff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 9999px;">🔑 Open Owner Admin &rarr;</a>
              <a href="${deskUrl}" target="_blank" style="display: inline-block; background: rgba(255,255,255,0.08); color: #fff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.15);">💈 Front Desk Station &rarr;</a>
            </div>
            <p style="margin: 28px 0 0 0; font-size: 12px; color: #64748b; text-align: center;">
              Auto-renews monthly &bull; Cancel anytime with 1-click &bull; Powered by Stripe
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return await dispatchEmail({
    to: cleanEmail,
    subject: `🎉 Your WaitLink Pro Upgrade is Confirmed! (500 SMS Credits Activated)`,
    html: emailHtml,
    text: `Congratulations! ${cleanShop} is now upgraded to ${cleanPlan} (${priceStr}). Included: 500 SMS/mo + Rollover Bank. Open Owner Admin at: ${adminUrl}`
  });
}

/**
 * Helper: Dispatches SMS top-up credit confirmation email.
 */
async function dispatchTopUpConfirmationEmailHelper({ email, shopName, slug, packName, amountPaid, addedCredits, newTotalBalance }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanShop = String(shopName || "Your Shop").trim();
  const cleanSlug = String(slug || "main-st-barbers").trim();
  const walletUrl = `https://waitlink.app?s=${cleanSlug}&view=owner&tab=notifications`;

  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>WaitLink SMS Top-Up Confirmed</title></head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        <tr>
          <td style="padding: 32px; text-align: center; background: linear-gradient(180deg, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <span style="font-size: 36px;">⚡</span>
            <h1 style="margin: 8px 0 0 0; font-size: 24px; color: #ffffff;">SMS Credits Added!</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #06b6d4; font-weight: 600;">+${addedCredits.toLocaleString()} SMS Credits Added to ${cleanShop}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
              Your one-time SMS Top-Up purchase was successful. Your credits have been deposited into your reserve wallet:
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin-bottom: 24px;">
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Package</td><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #fff; font-weight: 700; text-align: right; font-size: 13px;">${packName}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Amount Paid</td><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #10b981; font-weight: 700; text-align: right; font-size: 13px;">${amountPaid}</td></tr>
              <tr><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94a3b8; font-size: 13px;">Added Credits</td><td style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #06b6d4; font-weight: 700; text-align: right; font-size: 13px;">+${addedCredits.toLocaleString()} SMS</td></tr>
              <tr><td style="padding: 12px 16px; color: #94a3b8; font-size: 13px;">Total Balance Available</td><td style="padding: 12px 16px; color: #38bdf8; font-weight: 800; text-align: right; font-size: 14px;">${newTotalBalance.toLocaleString()} SMS</td></tr>
            </table>
            <div style="background: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 13px; color: #e2e8f0; line-height: 1.5;">
                🔒 <strong>Lifetime Guarantee:</strong> Your top-up credits <strong>never expire</strong>. They roll over month-to-month until 100% consumed.
              </p>
            </div>
            <div style="text-align: center; margin-top: 24px;">
              <a href="${walletUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%); color: #fff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 9999px;">View SMS Credit Wallet &rarr;</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return await dispatchEmail({
    to: cleanEmail,
    subject: `⚡ +${addedCredits.toLocaleString()} SMS Credits Added to Your WaitLink Reserve Wallet`,
    html: emailHtml,
    text: `Your top-up of +${addedCredits} SMS credits for ${cleanShop} is confirmed! New available balance: ${newTotalBalance} SMS. These credits never expire. View wallet at: ${walletUrl}`
  });
}

/**
 * Cloud Function: sendSubscriptionUpgradeEmail
 * Dispatches a confirmation email when a shop owner upgrades their plan.
 */
exports.sendSubscriptionUpgradeEmail = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { email, shopName, planTitle, planPrice, slug } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }

    try {
      const dispatchResult = await dispatchSubscriptionUpgradeEmailHelper({
        email,
        shopName,
        planTitle,
        planPrice,
        slug
      });

      return res.status(200).json({
        success: dispatchResult.success,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId,
        error: dispatchResult.error
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
});

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || localSecrets.stripe_secret_key || "";
const PRO_PRICE_ID = localSecrets.pro_price_id || "price_1UMbBvHXdog2I9XKNFauNDmJ";
const ENTERPRISE_PRICE_ID = localSecrets.enterprise_price_id || "price_1UMbCNHXdog2I9XK5sqqn8VA";

/**
 * Cloud Function: createStripeCheckoutSession
 * Securely creates a hosted Stripe Checkout Session for subscription plans ($15 Pro / $49 Enterprise).
 */
exports.createStripeCheckoutSession = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { tierKey, origin, slug } = req.body || {};
    const priceId = (tierKey === "enterprise") ? ENTERPRISE_PRICE_ID : PRO_PRICE_ID;
    const hostOrigin = (origin && typeof origin === "string" && /^https?:\/\//.test(origin)) ? origin.replace(/\/+$/, "") : "https://waitlink.app";
    const shopSlug = String(slug || "").trim().toLowerCase();
    if (!shopSlug) {
      return res.status(400).json({ success: false, error: "Parameter 'slug' is required." });
    }

    try {
      const decoded = await requireCaller(req);
      const shopSnap = await admin.firestore().collection("shops").doc(shopSlug).get();
      if (!shopSnap.exists) {
        return res.status(404).json({ success: false, error: "Shop does not exist." });
      }
      assertShopOwner(decoded, shopSnap.data() || {});
      const postParams = new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "subscription",
        "success_url": `${hostOrigin}?s=${encodeURIComponent(shopSlug)}&payment=success&tier=${encodeURIComponent(tierKey || 'pro')}&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${hostOrigin}?s=${encodeURIComponent(shopSlug)}&action=upgrade&tier=${encodeURIComponent(tierKey || 'pro')}&payment=cancelled`,
        "custom_text[submit][message]": "Need to compare options? Click the ← back arrow in the top-left header anytime to return to the WaitLink Subscription Plans page without charging your card.",
        "metadata[shopSlug]": shopSlug,
        "metadata[purpose]": "subscription",
        "client_reference_id": shopSlug
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY.trim()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: postParams.toString()
      });

      const data = await stripeRes.json();
      if (stripeRes.ok && data.url) {
        logger.info(`Stripe Checkout Session successfully generated: ${data.id} for slug ${shopSlug}`);
        return res.status(200).json({
          success: true,
          url: data.url,
          sessionId: data.id
        });
      } else {
        logger.error("Stripe API Session Error:", data);
        return res.status(stripeRes.status || 400).json({
          success: false,
          error: data.error ? data.error.message : "Failed to generate Stripe checkout session.",
          details: data
        });
      }
    } catch (err) {
      logger.error("Server error creating Stripe Checkout session:", err);
      return res.status(err.status || 500).json({
        success: false,
        error: err.status ? err.message : ("Internal server error connecting to Stripe: " + (err.message || "Unknown error"))
      });
    }
  });
});

/**
 * Cloud Function: createStripeTopUpSession
 * Securely creates a hosted Stripe Checkout Session for one-time SMS credit packs ($5 / $15 / $39).
 */
exports.createStripeTopUpSession = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { packId, slug, origin } = req.body || {};
    const cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug) {
      return res.status(400).json({ success: false, error: "Parameter 'slug' is required." });
    }

    try {
      const decodedTopUp = await requireCaller(req);
      const shopForTopUp = await admin.firestore().collection("shops").doc(cleanSlug).get();
      if (!shopForTopUp.exists) {
        return res.status(404).json({ success: false, error: "Shop does not exist." });
      }
      const shopForTopUpData = shopForTopUp.data() || {};
      assertShopOwner(decodedTopUp, shopForTopUpData);
      if (!shopIsPaid(shopForTopUpData)) {
        return res.status(403).json({
          success: false,
          tierUpgradeRequired: true,
          error: "Automated SMS alerts require an active Pro Business ($15/mo) or Enterprise plan. Upgrade to buy SMS credits."
        });
      }
    } catch (authErr) {
      const status = authErr.status || 401;
      return res.status(status).json({ success: false, error: authErr.message || "Unauthorized" });
    }

    let priceId = TOPUP_GROWTH_PRICE_ID;
    let credits = 1000;
    let priceCents = 1500;
    if (packId === "micro") {
      priceId = TOPUP_MICRO_PRICE_ID;
      credits = 250;
      priceCents = 500;
    } else if (packId === "power") {
      priceId = TOPUP_POWER_PRICE_ID;
      credits = 2500;
      priceCents = 3900;
    }

    const hostOrigin = (origin && typeof origin === "string") ? origin.replace(/\/+$/, "") : "https://waitlink.app";

    try {
      const postParams = new URLSearchParams({
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "client_reference_id": cleanSlug,
        "metadata[shopSlug]": cleanSlug,
        "metadata[packId]": packId || "growth",
        "metadata[addedCredits]": String(credits),
        "metadata[amountTotal]": String(priceCents),
        "metadata[purpose]": "topup",
        "success_url": `${hostOrigin}?s=${encodeURIComponent(cleanSlug)}&view=owner&topup=success&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${hostOrigin}?s=${encodeURIComponent(cleanSlug)}&view=owner&subtab=notifications&topup=cancel`,
        "custom_text[submit][message]": "Click the ← back arrow in the top-left header anytime to return to WaitLink SMS Settings without charging your card."
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY.trim()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: postParams.toString()
      });

      const data = await stripeRes.json();
      if (stripeRes.ok && data.url) {
        logger.info(`Stripe Top-Up Session successfully generated: ${data.id} for ${cleanSlug} pack: ${packId}`);
        return res.status(200).json({ success: true, url: data.url, sessionId: data.id });
      } else {
        logger.error("Stripe Top-Up Session Error:", data);
        return res.status(stripeRes.status || 400).json({
          success: false,
          error: data.error ? data.error.message : "Failed to create Stripe top-up session.",
          details: data
        });
      }
    } catch (err) {
      logger.error("Server error creating Stripe top-up session:", err);
      return res.status(500).json({ success: false, error: "Internal server error: " + err.message });
    }
  });
});

/**
 * Cloud Function: verifyStripeSessionAndUpgrade
 * Cryptographically verifies a completed Stripe Checkout Session with Stripe's API,
 * updates the shop's tier to Pro or Enterprise, initializes the SMS wallet,
 * and dispatches a luxury confirmation email to the shop owner.
 */
exports.verifyStripeSessionAndUpgrade = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Missing or invalid authorization token." });
    }

    const idToken = authHeader.split("Bearer ")[1].trim();
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authErr) {
      logger.warn("Auth token verification failed in verifyStripeSessionAndUpgrade:", authErr.message);
      return res.status(401).json({ success: false, error: "Unauthorized token: " + authErr.message });
    }

    const { sessionId, slug } = req.body || {};
    if (!sessionId || !slug) {
      return res.status(400).json({ success: false, error: "Both 'sessionId' and 'slug' parameters are required." });
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const cleanSessionId = String(sessionId).trim();

    try {
      // 1. Verify caller owns the shop or is SuperAdmin
      const shopDocRef = admin.firestore().collection("shops").doc(cleanSlug);
      const shopSnap = await shopDocRef.get();
      if (!shopSnap.exists) {
        return res.status(404).json({ success: false, error: "Shop does not exist." });
      }

      const shopData = shopSnap.data() || {};
      const callerEmail = (decodedToken.email || "").toLowerCase();
      const isSuper = callerEmail === SENDER_EMAIL.toLowerCase() || callerEmail === "senthil930@gmail.com";
      const isOwner = (shopData.ownerEmail && shopData.ownerEmail.toLowerCase() === callerEmail) ||
                      (shopData.ownerUid && shopData.ownerUid === decodedToken.uid);

      if (!isSuper && !isOwner) {
        return res.status(403).json({ success: false, error: "Forbidden: You are not the registered owner of this shop." });
      }

      // 2. Fetch Session from Stripe REST API
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(cleanSessionId)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY.trim()}`,
          "Content-Type": "application/json"
        }
      });

      const sessionData = await stripeRes.json();
      if (!stripeRes.ok || !sessionData || sessionData.error) {
        logger.error("Stripe fetch session error:", sessionData);
        return res.status(400).json({ success: false, error: "Invalid Stripe checkout session." });
      }

      // 3. Confirm payment status is paid
      if (sessionData.payment_status !== "paid") {
        return res.status(400).json({ success: false, error: `Session payment status is '${sessionData.payment_status}', not paid.` });
      }

      const upgradeMeta = sessionData.metadata || {};
      const upgradeShop = String(upgradeMeta.shopSlug || sessionData.client_reference_id || "");
      if (sessionData.mode !== "subscription" || upgradeMeta.purpose !== "subscription" || upgradeShop !== cleanSlug) {
        return res.status(403).json({ success: false, error: "This payment session does not belong to this shop's subscription." });
      }
      const upgradeAmount = sessionData.amount_total || 0;
      if (upgradeAmount !== 1500 && upgradeAmount !== 4900) {
        return res.status(403).json({ success: false, error: "This payment is not a WaitLink Pro or Enterprise subscription." });
      }
      const upgradeClaim = await claimStripeSession(cleanSessionId, cleanSlug, "subscription");
      if (upgradeClaim.already) {
        return res.status(200).json({
          success: true,
          alreadyUpgraded: true,
          tierTitle: shopData.planTitle,
          planPrice: shopData.planPrice,
          sessionId: cleanSessionId
        });
      }

      // 4. Determine tier based on line items or amount
      let tierTitle = "Pro Business Tier";
      let tierPrice = 15;
      if (sessionData.amount_total >= 4900) {
        tierTitle = "Enterprise Tier";
        tierPrice = 49;
      }

      // 5. Update shop in Firestore using Admin SDK
      await shopDocRef.update({
        planTitle: tierTitle,
        planPrice: tierPrice,
        subscriptionStatus: "active",
        stripeSessionId: cleanSessionId,
        stripeCustomerId: sessionData.customer || "",
        updatedAt: Date.now()
      });

      // 6. Initialize / verify SMS wallet subcollection
      const usageDocRef = shopDocRef.collection("billing").doc("smsUsage");
      const usageSnap = await usageDocRef.get();
      const allowance = (tierPrice >= 49) ? 2500 : 500;
      if (!usageSnap.exists) {
        await usageDocRef.set({
          monthlyAllowance: allowance,
          baseMonthlyQuota: allowance,
          rolledOverFromPriorMonth: 0,
          monthlyUsed: 0,
          topUpBalance: 0,
          totalAvailable: allowance,
          billingCycleStart: Date.now(),
          billingCycleEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
          lifetimeSent: 0,
          lastAlertThreshold: 0,
          tierTitle: tierTitle,
          tierPrice: tierPrice,
          recentDispatches: []
        });
      } else {
        const existingData = usageSnap.data() || {};
        const oldBase = existingData.baseMonthlyQuota || (existingData.monthlyAllowance > 1000 ? 2500 : 500);
        const delta = allowance - oldBase;
        const newAllowance = delta > 0
          ? (existingData.monthlyAllowance || oldBase) + delta
          : Math.min(allowance, existingData.monthlyAllowance || allowance);
        const newTotal = Math.max(0, newAllowance - (existingData.monthlyUsed || 0)) + (existingData.topUpBalance || 0);

        await usageDocRef.set({
          monthlyAllowance: newAllowance,
          baseMonthlyQuota: allowance,
          totalAvailable: newTotal,
          tierTitle: tierTitle,
          tierPrice: tierPrice,
          updatedAt: Date.now()
        }, { merge: true });
      }

      // 7. Dispatch luxury confirmation email to shop owner
      const targetEmail = shopData.ownerEmail || callerEmail;
      if (targetEmail) {
        dispatchSubscriptionUpgradeEmailHelper({
          email: targetEmail,
          shopName: shopData.shopName || cleanSlug,
          planTitle: tierTitle,
          planPrice: tierPrice,
          slug: cleanSlug
        }).catch(err => logger.warn("Upgrade confirmation email dispatch warning:", err.message));
      }

      logger.info(`Successfully upgraded shop ${cleanSlug} to ${tierTitle} ($${tierPrice}/mo) via verified session ${cleanSessionId}`);

      return res.status(200).json({
        success: true,
        tierTitle: tierTitle,
        planPrice: tierPrice,
        sessionId: cleanSessionId
      });
    } catch (err) {
      logger.error("Error in verifyStripeSessionAndUpgrade:", err);
      return res.status(err.status || 500).json({ success: false, error: err.status ? err.message : ("Internal server error verifying session: " + err.message) });
    }
  });
});

/**
 * Cloud Function: verifyStripeTopUpSession
 * Verifies a completed Stripe top-up checkout session, credits the shop's reserve wallet,
 * records an idempotent audit log, and dispatches an automated receipt confirmation email.
 */
exports.verifyStripeTopUpSession = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const { sessionId, slug } = req.body || {};
    if (!sessionId || !slug) {
      return res.status(400).json({ success: false, error: "Parameters 'sessionId' and 'slug' are required." });
    }

    const cleanSlug = String(slug).trim().toLowerCase();
    const cleanSessionId = String(sessionId).trim();

    try {
      const decodedTopUpVerify = await requireCaller(req);
      const shopDocRef = admin.firestore().collection("shops").doc(cleanSlug);
      const shopSnap = await shopDocRef.get();
      if (!shopSnap.exists) {
        return res.status(404).json({ success: false, error: "Shop does not exist." });
      }
      const shopData = shopSnap.data() || {};
      assertShopOwner(decodedTopUpVerify, shopData);

      // Idempotency check: has this session already been credited?
      const topUpHistoryRef = shopDocRef.collection("top_ups").doc(cleanSessionId);
      const existingHistory = await topUpHistoryRef.get();
      if (existingHistory.exists) {
        const histData = existingHistory.data();
        const usageSnap = await shopDocRef.collection("billing").doc("smsUsage").get();
        const curUsage = usageSnap.data() || {};
        return res.status(200).json({
          success: true,
          alreadyCredited: true,
          addedCredits: histData.addedCredits || 0,
          totalAvailable: curUsage.totalAvailable || 0,
          packName: histData.packName || "Growth Pack (+1,000 SMS)"
        });
      }

      // Fetch from Stripe REST API
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(cleanSessionId)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY.trim()}`,
          "Content-Type": "application/json"
        }
      });
      const sessionData = await stripeRes.json();
      if (!stripeRes.ok || !sessionData || sessionData.error) {
        return res.status(400).json({ success: false, error: "Invalid Stripe checkout session." });
      }
      if (sessionData.payment_status !== "paid") {
        return res.status(400).json({ success: false, error: `Payment status is '${sessionData.payment_status}', not paid.` });
      }

      const topUpMeta = sessionData.metadata || {};
      const topUpShop = String(topUpMeta.shopSlug || sessionData.client_reference_id || "");
      if (sessionData.mode !== "payment" || topUpMeta.purpose !== "topup" || topUpShop !== cleanSlug) {
        return res.status(403).json({ success: false, error: "This payment session does not belong to this shop." });
      }

      // Credits come from the amount Stripe collected, not from caller-supplied metadata.
      let addedCredits = 0;
      let packName = "";
      let packPrice = "";
      const totalAmount = sessionData.amount_total || 0;
      if (totalAmount === 3900) { addedCredits = 2500; packName = "Power Pack (+2,500 SMS)"; packPrice = "$39.00"; }
      else if (totalAmount === 1500) { addedCredits = 1000; packName = "Growth Pack (+1,000 SMS)"; packPrice = "$15.00"; }
      else if (totalAmount === 500) { addedCredits = 250; packName = "Micro Pack (+250 SMS)"; packPrice = "$5.00"; }
      else {
        return res.status(403).json({ success: false, error: "This payment is not a WaitLink SMS credit pack." });
      }

      const topUpClaim = await claimStripeSession(cleanSessionId, cleanSlug, "topup");
      if (topUpClaim.already) {
        const usageSnapExisting = await shopDocRef.collection("billing").doc("smsUsage").get();
        const curUsage = usageSnapExisting.data() || {};
        return res.status(200).json({
          success: true,
          alreadyCredited: true,
          addedCredits: addedCredits,
          totalAvailable: curUsage.totalAvailable || 0,
          packName: packName
        });
      }

      // Atomically update smsUsage
      const usageDocRef = shopDocRef.collection("billing").doc("smsUsage");
      const usageSnap = await usageDocRef.get();
      let usageData = usageSnap.exists ? usageSnap.data() : {
        monthlyAllowance: 500,
        rolledOverFromPriorMonth: 0,
        monthlyUsed: 0,
        topUpBalance: 0,
        totalAvailable: 500,
        billingCycleStart: Date.now(),
        billingCycleEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lifetimeSent: 0,
        lastAlertThreshold: 0,
        recentDispatches: []
      };

      usageData.topUpBalance = (usageData.topUpBalance || 0) + addedCredits;
      usageData.totalAvailable = Math.max(0, (usageData.monthlyAllowance || 500) - (usageData.monthlyUsed || 0)) + usageData.topUpBalance;
      usageData.updatedAt = Date.now();

      await usageDocRef.set(usageData, { merge: true });

      // Save top-up history record for audit and idempotency
      await topUpHistoryRef.set({
        sessionId: cleanSessionId,
        addedCredits: addedCredits,
        amountPaid: totalAmount / 100,
        packName: packName,
        createdAt: Date.now(),
        stripeCustomerId: sessionData.customer || ""
      });

      // Dispatch SMS Top-Up Credit Confirmation Email
      if (shopData.ownerEmail) {
        dispatchTopUpConfirmationEmailHelper({
          email: shopData.ownerEmail,
          shopName: shopData.shopName || cleanSlug,
          slug: cleanSlug,
          packName: packName,
          amountPaid: packPrice,
          addedCredits: addedCredits,
          newTotalBalance: usageData.totalAvailable
        }).catch(err => logger.warn("Top-up confirmation email warning:", err.message));
      }

      logger.info(`Successfully added +${addedCredits} SMS credits to ${cleanSlug} via session ${cleanSessionId}`);

      return res.status(200).json({
        success: true,
        addedCredits: addedCredits,
        totalAvailable: usageData.totalAvailable,
        topUpBalance: usageData.topUpBalance,
        sessionId: cleanSessionId,
        packName: packName
      });
    } catch (err) {
      logger.error("Error in verifyStripeTopUpSession:", err);
      return res.status(err.status || 500).json({ success: false, error: err.status ? err.message : ("Internal server error: " + err.message) });
    }
  });
});

/**
 * Cloud Function: adjustShopSmsCredits
 * SuperAdmin endpoint to manually grant courtesy or support credits with an audit reason.
 */
exports.adjustShopSmsCredits = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Unauthorized token required." });
    }

    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1].trim());
      const caller = (decoded.email || "").toLowerCase();
      const isSuper = caller === SENDER_EMAIL.toLowerCase() || caller === "senthil930@gmail.com";
      if (!isSuper) {
        return res.status(403).json({ success: false, error: "Forbidden: SuperAdmin authentication required." });
      }

      const { slug, amount, customMonthlyQuota, reason } = req.body || {};
      const cleanSlug = String(slug || "").trim().toLowerCase();
      const delta = (amount !== undefined && amount !== null && amount !== "" && !isNaN(parseInt(amount, 10))) ? parseInt(amount, 10) : 0;
      const parsedQuota = (customMonthlyQuota !== undefined && customMonthlyQuota !== null && customMonthlyQuota !== "" && !isNaN(parseInt(customMonthlyQuota, 10))) ? parseInt(customMonthlyQuota, 10) : null;

      if (!cleanSlug || (delta === 0 && parsedQuota === null)) {
        return res.status(400).json({ success: false, error: "Parameters 'slug' and either non-zero 'amount' or numeric 'customMonthlyQuota' are required." });
      }

      const shopDocRef = admin.firestore().collection("shops").doc(cleanSlug);
      const usageDocRef = shopDocRef.collection("billing").doc("smsUsage");
      const usageSnap = await usageDocRef.get();
      let usageData = usageSnap.exists ? usageSnap.data() : {
        monthlyAllowance: 500,
        baseMonthlyQuota: 500,
        rolledOverFromPriorMonth: 0,
        monthlyUsed: 0,
        topUpBalance: 0,
        totalAvailable: 500,
        billingCycleStart: Date.now(),
        billingCycleEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
        lifetimeSent: 0,
        lastAlertThreshold: 0,
        recentDispatches: []
      };

      if (parsedQuota !== null) {
        usageData.baseMonthlyQuota = parsedQuota;
        usageData.monthlyAllowance = parsedQuota;
        await shopDocRef.set({ customMonthlyQuota: parsedQuota }, { merge: true });
      }

      if (delta !== 0) {
        usageData.topUpBalance = Math.max(0, (usageData.topUpBalance || 0) + delta);
      }

      usageData.totalAvailable = Math.max(0, (usageData.monthlyAllowance || 500) - (usageData.monthlyUsed || 0)) + (usageData.topUpBalance || 0);
      usageData.updatedAt = Date.now();

      await usageDocRef.set(usageData, { merge: true });

      // Record audit entry in shop credit_audits
      await shopDocRef.collection("credit_audits").add({
        amount: delta,
        customMonthlyQuota: parsedQuota,
        reason: String(reason || "SuperAdmin courtesy adjustment").trim(),
        adjustedBy: caller,
        timestamp: Date.now(),
        newTotal: usageData.totalAvailable
      });

      // Record in global pricing_audits
      await admin.firestore().collection("pricing_audits").add({
        id: "audit_" + Date.now(),
        timestamp: Date.now(),
        adminEmail: caller,
        changes: [`SuperAdmin override on shop "${cleanSlug}": ${delta ? `Credits: ${delta > 0 ? '+' : ''}${delta} Top-Up SMS. ` : ''}${parsedQuota !== null ? `Custom Monthly Quota: ${parsedQuota} SMS. ` : ''}Reason: ${reason || 'N/A'}`]
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        adjustedAmount: delta,
        customMonthlyQuota: parsedQuota,
        newBalance: usageData.totalAvailable,
        topUpBalance: usageData.topUpBalance,
        monthlyAllowance: usageData.monthlyAllowance
      });
    } catch (err) {
      logger.error("Error in adjustShopSmsCredits:", err);
      return res.status(500).json({ success: false, error: "Server error: " + err.message });
    }
  });
});

/**
 * Cloud Function: sendSupportReply
 * Dispatches a customer support response email server-side via Brevo (with Resend fallback).
 * This eliminates the need to expose any email service API keys to the browser.
 */
exports.sendSupportReply = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const idToken = authHeader.split("Bearer ")[1].trim();
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        const caller = (decoded.email || "").toLowerCase();
        const isSuper = caller === SENDER_EMAIL.toLowerCase() || caller === "senthil930@gmail.com";
        if (!isSuper) {
          logger.warn("Non-admin attempted support reply:", caller);
          return res.status(403).json({ success: false, error: "Forbidden: SuperAdmin authentication required to dispatch support replies." });
        }
      } catch (authErr) {
        logger.warn("Support reply token verification failed:", authErr.message);
        return res.status(401).json({ success: false, error: "Unauthorized token: " + authErr.message });
      }
    }

    const { email, replyText, inquiryId, shopName } = req.body || {};
    if (!email || !replyText) {
      return res.status(400).json({ success: false, error: "Parameters 'email' and 'replyText' are required." });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanReply = String(replyText).trim();
    const cleanShop = String(shopName || "").trim();

    const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>WaitLink Customer Support</title></head>
<body style="margin: 0; padding: 0; background-color: #080d1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #080d1a; padding: 40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
        <tr>
          <td style="padding: 24px 32px; background: linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="font-size: 24px; line-height: 1; margin-bottom: 6px;">⚡</div>
            <h1 style="margin: 0; font-size: 20px; color: #ffffff;">Wait<span style="color: #06b6d4;">Link</span> Customer Support</h1>
            ${cleanShop ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Regarding: ${cleanShop}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 32px;">
            <p style="margin: 0 0 16px 0; font-size: 15px; color: #cbd5e1;">Hello,</p>
            <div style="background: rgba(6, 182, 212, 0.06); border-left: 4px solid #06b6d4; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #f8fafc; white-space: pre-wrap; margin-bottom: 24px;">${cleanReply}</div>
            <hr style="border: none; border-top: 1px solid rgba(255, 255, 255, 0.08); margin: 24px 0 16px 0;" />
            <p style="font-size: 12px; color: #64748b; margin: 0;">
              <strong>WaitLink Customer Support Team</strong> &bull; <a href="https://waitlink.app" style="color: #06b6d4; text-decoration: none;">waitlink.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const dispatchResult = await dispatchEmail({
      to: cleanEmail,
      subject: cleanShop ? `Re: WaitLink Support Inquiry (${cleanShop})` : "Re: WaitLink Support Inquiry",
      html: emailHtml,
      text: `${cleanReply}\n\n----------------------------------------\nWaitLink Customer Support Team\nhttps://waitlink.app`
    });

    if (dispatchResult.success) {
      return res.status(200).json({
        success: true,
        provider: dispatchResult.provider,
        messageId: dispatchResult.messageId
      });
    }

    return res.status(500).json({
      success: false,
      error: dispatchResult.error || "Failed to dispatch support reply email.",
      details: dispatchResult.details
    });
  });
});

/**
 * Cloud Function: createStripePortalSession
 * Generates a direct redirect URL to Stripe's Customer Billing Portal
 * allowing shop owners to view receipts, manage cards, and change subscriptions.
 */
exports.createStripePortalSession = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1].trim());
    } catch (e) {
      return res.status(401).json({ success: false, error: "Invalid token: " + e.message });
    }

    const { slug, returnUrl } = req.body || {};
    const cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug) {
      return res.status(400).json({ success: false, error: "Parameter 'slug' is required." });
    }

    try {
      const shopDoc = await admin.firestore().collection("shops").doc(cleanSlug).get();
      if (!shopDoc.exists) {
        return res.status(404).json({ success: false, error: "Shop not found." });
      }
      const shopData = shopDoc.data() || {};
      const callerEmail = (decodedToken.email || "").toLowerCase();
      const isSuper = callerEmail === SENDER_EMAIL.toLowerCase() || callerEmail === "senthil930@gmail.com";
      const isOwner = (shopData.ownerEmail && shopData.ownerEmail.toLowerCase() === callerEmail) ||
                      (shopData.ownerUid && shopData.ownerUid === decodedToken.uid);

      if (!isSuper && !isOwner) {
        return res.status(403).json({ success: false, error: "Forbidden: Not the shop owner." });
      }

      const customerId = shopData.stripeCustomerId;
      if (!customerId) {
        return res.status(400).json({
          success: false,
          noCustomer: true,
          error: "No active Stripe customer found for this shop. Please subscribe via the pricing modal."
        });
      }

      const postParams = new URLSearchParams({
        "customer": customerId,
        "return_url": returnUrl || `https://waitlink.app?s=${encodeURIComponent(cleanSlug)}&view=owner`
      });

      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY.trim()}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: postParams.toString()
      });

      const portalData = await portalRes.json();
      if (portalRes.ok && portalData.url) {
        return res.status(200).json({ success: true, url: portalData.url });
      } else {
        return res.status(portalRes.status || 400).json({
          success: false,
          error: (portalData.error && portalData.error.message) || "Failed to create portal session",
          details: portalData
        });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: "Server error: " + err.message });
    }
  });
});

const crypto = require("crypto");

function shopIsPaid(data) {
  const price = data && data.planPrice !== undefined && data.planPrice !== null ? Number(data.planPrice) : 0;
  const status = String((data && data.subscriptionStatus) || "").toLowerCase();
  return price >= 15 || status === "active" || status === "trialing";
}

function generateRollingToken(slug, secret, intervalSec, timeMs) {
  const timeSlice = Math.floor(timeMs / 1000 / intervalSec);
  const str = `${slug || "shop"}:${secret || "waitlink-salt"}:${timeSlice}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return (part1 + part2).slice(0, 8);
}

function rollingTokenIsRecent(slug, secret, token, intervalSec, now, maxAgeSec) {
  if (!token || typeof token !== "string") return false;
  const clean = token.trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(clean)) return false;
  const step = Math.max(1, parseInt(intervalSec, 10) || 60);
  const slices = Math.ceil(Math.max(step, maxAgeSec) / step);
  for (let i = 0; i <= slices; i++) {
    if (generateRollingToken(slug, secret, step, now - (i * step * 1000)) === clean) return true;
  }
  return false;
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function staffGuardRef(shopId, username) {
  const key = `${shopId || "shop"}__${username || "pin"}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 700);
  return admin.firestore().collection("staff_login_guards").doc(key || "staff_guard");
}

async function consumeStaffLoginAttempt(shopId, username) {
  const ref = staffGuardRef(shopId, username);
  const max = 8;
  const windowMs = 15 * 60 * 1000;
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const prev = snap.exists ? (snap.data() || {}) : {};
    const inWindow = prev.windowStart && (now - prev.windowStart) < windowMs;
    const failures = inWindow ? (parseInt(prev.failures, 10) || 0) : 0;
    if (failures >= max) return false;
    tx.set(ref, {
      shopId: shopId || "",
      failures: failures + 1,
      windowStart: inWindow ? prev.windowStart : now,
      updatedAt: now
    });
    return true;
  });
}

async function clearStaffLoginAttempt(shopId, username) {
  await staffGuardRef(shopId, username).set({
    shopId: shopId || "",
    failures: 0,
    windowStart: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function requireCaller(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw httpError(401, "Missing or invalid authorization token.");
  }
  const idToken = authHeader.split("Bearer ")[1].trim();
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (authErr) {
    throw httpError(401, "Unauthorized token.");
  }
}

function assertShopOwner(decoded, shopData) {
  const email = String((decoded && decoded.email) || "").toLowerCase();
  const isSuper = email === String(SENDER_EMAIL || "").toLowerCase() || email === "senthil930@gmail.com";
  if (isSuper) return;
  const ownerEmail = String((shopData && shopData.ownerEmail) || "").toLowerCase();
  const isOwner = (ownerEmail && ownerEmail === email) || (shopData && shopData.ownerUid && shopData.ownerUid === decoded.uid);
  if (!isOwner) {
    throw httpError(403, "Forbidden: You are not the registered owner of this shop.");
  }
}

async function claimStripeSession(sessionId, slug, purpose) {
  const ref = admin.firestore().collection("stripe_sessions").doc(String(sessionId));
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const prev = snap.data() || {};
      if (prev.slug === slug && prev.purpose === purpose) return { already: true };
      throw httpError(409, "This payment session was already used.");
    }
    tx.set(ref, { slug, purpose, createdAt: Date.now() });
    return { already: false };
  });
}

function hashStaffPasscodeServer(passcode) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(passcode), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyStaffPasscodeRecord(record, passcode) {
  const raw = String(passcode || "").trim();
  if (!raw || !record) return false;
  const stored = String(record.passcodeHash || "");
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const calc = crypto.scryptSync(raw, parts[1], 32);
    const prev = Buffer.from(parts[2], "hex");
    if (prev.length !== calc.length) return false;
    return crypto.timingSafeEqual(prev, calc);
  }
  const sha = crypto.createHash("sha256").update(raw).digest("hex");
  if (stored && stored === sha) return true;
  return !!(record.passcode && String(record.passcode).trim() === raw);
}

function stationKeyMatches(record, secret) {
  const stored = String((record && record.stationKey) || "");
  const raw = String(secret || "");
  if (stored.length < 20 || raw.length !== stored.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(raw));
  } catch (err) {
    return false;
  }
}

function publicLiveFromShop(data, queue, slug) {
  const list = Array.isArray(queue) ? queue : [];
  const base = parseInt(data.estBaseWaitMin, 10) || 20;
  let total = 0;
  list.forEach((item) => {
    const duration = parseInt(item && item.selectedServiceDurationMin, 10);
    total += duration > 0 ? duration : base;
  });
  const services = Array.isArray(data.services) ? data.services.map((service) => ({
    id: service.id,
    name: service.name,
    icon: service.icon || "",
    estDurationMin: service.estDurationMin || 20,
    enabled: service.enabled !== false
  })) : [];
  return {
    shopName: data.shopName || data.name || slug,
    slug: data.slug || slug,
    address: data.address || "",
    phone: data.phone || "",
    hours: data.hours || "",
    estBaseWaitMin: base,
    enableServices: !!data.enableServices,
    services,
    clinicalPrivacyEnabled: !!data.clinicalPrivacyEnabled,
    logoUrl: shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true ? (data.logoUrl || "") : "",
    promoText: shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true ? (data.promoText || "") : "",
    promoStart: shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true ? (data.promoStart || "") : "",
    promoEnd: shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true ? (data.promoEnd || "") : "",
    isActive: data.isActive !== false && data.status !== "paused" && data.status !== "inactive",
    status: data.status || (data.isActive === false ? "paused" : "active"),
    tagline: data.tagline || "",
    activeQueueCount: list.length,
    currentAvgWaitMin: list.length === 0 ? 0 : Math.max(5, total),
    isDemoShop: !!data.isDemoShop,
    rollingQrEnabled: !!(data.security && data.security.rollingQrEnabled),
    updatedAt: Date.now()
  };
}

function publicTicketName(name) {
  const clean = String(name || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const parts = clean.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 40);
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`.slice(0, 80);
}

function customerTicketPayload(item, slug, position, status) {
  return {
    id: item.id,
    shopSlug: slug,
    customerName: publicTicketName(item.customerName),
    status: status || item.status || "waiting",
    checkedInAt: item.checkedInAt || Date.now(),
    linePosition: position || 0,
    selectedServiceId: item.selectedServiceId || null,
    selectedServiceName: item.selectedServiceName || null,
    selectedServiceDurationMin: item.selectedServiceDurationMin || null,
    delayedMinutes: item.delayedMinutes || 0,
    lateReportCount: item.lateReportCount || 0,
    updatedAt: Date.now()
  };
}

function waitForQueueIndex(queue, index, baseWait) {
  let total = 0;
  const limit = Math.max(0, index);
  for (let i = 0; i < limit && i < queue.length; i++) {
    const duration = parseInt(queue[i].selectedServiceDurationMin, 10);
    total += duration > 0 ? duration : baseWait;
  }
  return queue.length === 0 || limit === 0 ? 0 : Math.max(5, total);
}

async function resolveShopRef(rawSlug, rawName) {
  const db = admin.firestore();
  const cleanSlug = String(rawSlug || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (cleanSlug) {
    const direct = await db.collection("shops").doc(cleanSlug).get();
    if (direct.exists) return { ref: direct.ref, id: direct.id, data: direct.data() || {} };
  }
  const name = String(rawName || rawSlug || "").trim();
  if (name) {
    const byShopName = await db.collection("shops").where("shopName", "==", name).limit(1).get();
    if (!byShopName.empty) {
      const doc = byShopName.docs[0];
      return { ref: doc.ref, id: doc.id, data: doc.data() || {} };
    }
    const byName = await db.collection("shops").where("name", "==", name).limit(1).get();
    if (!byName.empty) {
      const doc = byName.docs[0];
      return { ref: doc.ref, id: doc.id, data: doc.data() || {} };
    }
  }
  return null;
}

exports.staffLogin = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }
    const { slug, shopName, username, passcode } = req.body || {};
    const cleanUser = String(username || "").trim().toLowerCase();
    const cleanPass = String(passcode || "").trim();
    if (!cleanPass || (!slug && !shopName)) {
      return res.status(400).json({ success: false, error: "Store location and passcode are required." });
    }
    try {
      const shop = await resolveShopRef(slug, shopName);
      if (!shop) {
        const unknownAllowed = await consumeStaffLoginAttempt(String(slug || shopName || "unknown"), cleanUser);
        if (!unknownAllowed) {
          return res.status(429).json({ success: false, error: "Too many sign-in attempts. Wait a few minutes and try again." });
        }
        return res.status(404).json({ success: false, error: "Shop not found." });
      }
      const loginAllowed = await consumeStaffLoginAttempt(shop.id, cleanUser);
      if (!loginAllowed) {
        return res.status(429).json({ success: false, error: "Too many sign-in attempts. Wait a few minutes and try again." });
      }
      let query = shop.ref.collection("staff_roles");
      if (cleanUser) query = query.where("username", "==", cleanUser);
      const snap = await query.limit(25).get();
      const matches = [];
      snap.forEach((doc) => {
        const data = doc.data() || {};
        const passOk = verifyStaffPasscodeRecord(data, cleanPass);
        const stationOk = !passOk && stationKeyMatches(data, cleanPass);
        if (passOk || stationOk) matches.push({ id: doc.id, ref: doc.ref, data, passOk });
      });
      if (matches.length !== 1) {
        return res.status(401).json({ success: false, error: "Invalid store, username, or passcode." });
      }
      const matched = matches[0];
      const stored = String(matched.data.passcodeHash || "");
      if (matched.passOk && !stored.startsWith("scrypt$")) {
        await matched.ref.set({
          passcodeHash: hashStaffPasscodeServer(cleanPass),
          passcode: admin.firestore.FieldValue.delete(),
          updatedAt: Date.now()
        }, { merge: true });
      }
      await clearStaffLoginAttempt(shop.id, cleanUser);
      const staffId = String(matched.id);
      const uid = (`staff_${shop.id}_${staffId}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
      let token = "";
      try {
        token = await admin.auth().createCustomToken(uid || `staff_${staffId}`.slice(0, 128), {
          role: "staff",
          shopSlug: shop.id,
          staffId
        });
      } catch (tokenErr) {
        logger.error("Staff custom token error:", tokenErr);
        return res.status(500).json({ success: false, error: "Staff sign-in could not be completed." });
      }
      return res.status(200).json({
        success: true,
        token,
        slug: shop.id,
        shopName: shop.data.shopName || shop.data.name || shop.id,
        staff: {
          id: staffId,
          username: matched.data.username || cleanUser,
          displayName: matched.data.displayName || matched.data.username || "Front Desk",
          role: matched.data.role || "front_desk",
          roleTitle: matched.data.roleTitle || "Front Desk",
          permissions: matched.data.permissions || {},
          assignedShop: shop.id,
          assignedShopName: shop.data.shopName || shop.data.name || shop.id
        }
      });
    } catch (err) {
      logger.error("staffLogin error:", err);
      return res.status(err.status || 500).json({ success: false, error: err.message || "Staff sign-in failed." });
    }
  });
});

exports.ensurePublicShopView = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }
    const slug = String((req.body && req.body.slug) || "").trim().toLowerCase();
    if (!slug) return res.status(400).json({ success: false, error: "Parameter 'slug' is required." });
    try {
      const shopSnap = await admin.firestore().collection("shops").doc(slug).get();
      if (!shopSnap.exists) return res.status(404).json({ success: false, error: "Shop not found." });
      const data = shopSnap.data() || {};
      const live = publicLiveFromShop(data, data.queue || [], slug);
      await shopSnap.ref.collection("public").doc("live").set(live);
      return res.status(200).json({ success: true, shop: live });
    } catch (err) {
      logger.error("ensurePublicShopView error:", err);
      return res.status(500).json({ success: false, error: "Could not load this shop's public wait." });
    }
  });
});

exports.publicQueueAction = onRequest({ cors: true, maxInstances: 20 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }
    const body = req.body || {};
    const action = String(body.action || "").trim().toLowerCase();
    const slug = String(body.slug || "").trim().toLowerCase();
    if (!slug || !action) {
      return res.status(400).json({ success: false, error: "Parameters 'slug' and 'action' are required." });
    }
    const shopRef = admin.firestore().collection("shops").doc(slug);
    try {
      if (action === "qr") {
        const shopSnap = await shopRef.get();
        if (!shopSnap.exists) throw httpError(404, "Shop not found.");
        const data = shopSnap.data() || {};
        const sec = data.security && typeof data.security === "object" ? data.security : {};
        const honorShopSecurity = shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true;
        if (!honorShopSecurity || !sec.rollingQrEnabled) {
          return res.status(200).json({ success: true, allowed: true, rolling: false });
        }
        const platformSnap = await admin.firestore().collection("settings").doc("security_config").get();
        const platform = platformSnap.exists ? (platformSnap.data() || {}) : {};
        if (platform.rollingQrPlatformActive === false) {
          return res.status(200).json({ success: true, allowed: true, rolling: false });
        }
        const secret = sec.rollingSecret || "waitlink-salt";
        const interval = parseInt(sec.rollingQrIntervalSec, 10) || 60;
        const current = generateRollingToken(slug, secret, interval, Date.now());
        const presented = String(body.rollingToken || "").trim().toLowerCase();
        return res.status(200).json({ success: true, allowed: presented === current, rolling: true });
      }
      const result = await admin.firestore().runTransaction(async (tx) => {
        const shopSnap = await tx.get(shopRef);
        if (!shopSnap.exists) throw httpError(404, "Shop not found.");
        const data = shopSnap.data() || {};
        const queue = Array.isArray(data.queue) ? data.queue.slice() : [];
        const history = Array.isArray(data.history) ? data.history.slice() : [];
        const active = data.isActive !== false && data.status !== "paused" && data.status !== "inactive";

        if (action === "checkin") {
          if (!active) throw httpError(403, "Walk-in arrivals are currently paused for this location.");
          if (queue.length >= 250) {
            throw httpError(429, "This line is full right now. Please check with the front desk.");
          }
          const rateRef = shopRef.collection("public").doc("checkin_rate");
          const rateSnap = await tx.get(rateRef);
          const nowMs = Date.now();
          const rate = rateSnap.exists ? (rateSnap.data() || {}) : {};
          const inWindow = rate.windowStart && (nowMs - rate.windowStart) < 60000;
          const recentCheckins = inWindow ? (parseInt(rate.count, 10) || 0) : 0;
          if (recentCheckins >= 40) {
            throw httpError(429, "This shop is taking check-ins too quickly. Wait a moment and try again.");
          }
          const sec = data.security && typeof data.security === "object" ? data.security : {};
          let platform = {};
          if (sec.rollingQrEnabled || sec.gpsProximityEnabled) {
            const platformSnap = await tx.get(admin.firestore().collection("settings").doc("security_config"));
            platform = platformSnap.exists ? (platformSnap.data() || {}) : {};
          }
          const honorShopSecurity = shopIsPaid(data) || slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true;
          if (honorShopSecurity && sec.rollingQrEnabled && platform.rollingQrPlatformActive !== false) {
            const secret = sec.rollingSecret || "waitlink-salt";
            const interval = parseInt(sec.rollingQrIntervalSec, 10) || 60;
            if (!rollingTokenIsRecent(slug, secret, body.rollingToken, interval, nowMs, 10 * 60)) {
              throw httpError(403, "Code expired. Scan the live QR code on the counter screen.");
            }
          }
          if (honorShopSecurity && sec.gpsProximityEnabled && platform.gpsProximityPlatformActive !== false && sec.storeLatitude && sec.storeLongitude) {
            const lat = Number(body.latitude);
            const lon = Number(body.longitude);
            const accuracy = Math.min(Math.max(Number(body.accuracy) || 0, 0), 75);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
              throw httpError(403, "Location is required to join this line.");
            }
            const allowedMeters = (parseInt(sec.gpsRadiusMeters, 10) || 100) + accuracy;
            if (distanceMeters(lat, lon, Number(sec.storeLatitude), Number(sec.storeLongitude)) > allowedMeters) {
              throw httpError(403, "Too far from the shop to join this line.");
            }
          }
          const customerName = String(body.customerName || "").trim();
          if (customerName.length < 1 || customerName.length > 100) {
            throw httpError(400, "Enter a name between 1 and 100 characters.");
          }
          const phone = String(body.phone || "").trim().slice(0, 30);
          const phoneDigits = phone.replace(/\D/g, "");
          if (phoneDigits.length >= 7 && queue.some((item) => String(item.phone || "").replace(/\D/g, "") === phoneDigits)) {
            throw httpError(409, "A check-in with this phone number is already waiting in line.");
          }
          const period = new Date().toISOString().slice(0, 7);
          let monthlyCount = data.monthlyCheckinPeriod === period ? (parseInt(data.monthlyCheckinCount, 10) || 0) : 0;
          const demoShop = slug === "main-st-barbers" || slug.startsWith("demo-") || data.isDemoShop === true;
          if (!shopIsPaid(data) && !demoShop && monthlyCount >= 100) {
            throw httpError(402, "This shop has reached its free monthly check-in limit. Please visit the front desk.");
          }
          const ticketSecret = crypto.randomBytes(18).toString("hex");
          const newItem = {
            id: "q_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex"),
            shopSlug: slug,
            customerName,
            phone: phone || null,
            tcpaConsent: !!body.tcpaConsent,
            tcpaConsentTimestamp: body.tcpaConsent ? Date.now() : null,
            checkedInAt: Date.now(),
            checkedInVia: "public",
            selectedServiceId: body.selectedServiceId || null,
            selectedServiceName: body.selectedServiceName || null,
            selectedServiceDurationMin: body.selectedServiceDurationMin || null,
            ticketSecret
          };
          queue.push(newItem);
          const position = queue.length;
          const live = publicLiveFromShop(data, queue, slug);
          tx.update(shopRef, {
            queue,
            monthlyCheckinPeriod: period,
            monthlyCheckinCount: monthlyCount + 1,
            activeQueueCount: queue.length,
            currentAvgWaitMin: live.currentAvgWaitMin,
            updatedAt: Date.now()
          });
          tx.set(rateRef, {
            windowStart: inWindow ? rate.windowStart : nowMs,
            count: recentCheckins + 1,
            updatedAt: nowMs
          });
          tx.set(shopRef.collection("public").doc("live"), live);
          tx.set(shopRef.collection("tickets").doc(newItem.id), customerTicketPayload(newItem, slug, position, "waiting"));
      return {
        ticket: {
          ...customerTicketPayload(newItem, slug, position, "waiting"),
          customerName,
          phone: phone || "",
          ticketSecret,
          estimatedWaitMin: waitForQueueIndex(queue, position, live.estBaseWaitMin)
        },
            position,
            activeQueueCount: queue.length,
            currentAvgWaitMin: live.currentAvgWaitMin
          };
        }

        const ticketId = String(body.ticketId || "").trim();
        const ticketSecret = String(body.ticketSecret || "");
        const index = queue.findIndex((item) => item && item.id === ticketId);
        const historyIndex = index < 0 ? history.findIndex((item) => item && item.id === ticketId) : -1;
        const held = index >= 0 ? queue[index] : (historyIndex >= 0 ? history[historyIndex] : null);
        if (!ticketId || !held) throw httpError(404, "That ticket is not in this shop's line.");
        if (!held.ticketSecret || held.ticketSecret !== ticketSecret) {
          throw httpError(403, "This ticket cannot be changed from this device.");
        }
        if (action === "cancel" && index < 0) throw httpError(409, "This visit is no longer waiting in line.");

        if (action === "cancel") {
          const removed = queue.splice(index, 1)[0];
          removed.status = "cancelled";
          removed.cancelledBy = "customer";
          removed.cancelledAt = Date.now();
          history.unshift(removed);
          const capped = history.slice(0, 50);
          const live = publicLiveFromShop(data, queue, slug);
          tx.update(shopRef, {
            queue,
            history: capped,
            activeQueueCount: queue.length,
            currentAvgWaitMin: live.currentAvgWaitMin,
            updatedAt: Date.now()
          });
          tx.set(shopRef.collection("public").doc("live"), live);
          tx.set(shopRef.collection("tickets").doc(ticketId), customerTicketPayload(removed, slug, 0, "cancelled"));
          queue.forEach((item, idx) => {
            tx.set(shopRef.collection("tickets").doc(item.id), customerTicketPayload(item, slug, idx + 1, "waiting"));
          });
          return { cancelled: true, activeQueueCount: queue.length, currentAvgWaitMin: live.currentAvgWaitMin };
        }

        if (action === "delay") {
          const minutes = parseInt(body.minutes, 10);
          if (![5, 10, 15].includes(minutes)) throw httpError(400, "Choose a 5, 10, or 15 minute delay.");
          if (held.lateReportCount > 0 || held.delayedMinutes) {
            throw httpError(409, "A delay was already sent for this ticket.");
          }
          held.delayedMinutes = minutes;
          held.lateReportedAt = Date.now();
          held.lateReportCount = 1;
          const live = publicLiveFromShop(data, queue, slug);
          const status = index >= 0 ? "waiting" : (held.status || "called");
          const position = index >= 0 ? index + 1 : 0;
          tx.update(shopRef, {
            queue,
            history: history.slice(0, 50),
            updatedAt: Date.now()
          });
          tx.set(shopRef.collection("tickets").doc(ticketId), customerTicketPayload(held, slug, position, status));
          return { delayed: true, minutes, linePosition: position, activeQueueCount: queue.length, currentAvgWaitMin: live.currentAvgWaitMin };
        }

        throw httpError(400, "Unknown queue action.");
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.warn("publicQueueAction:", err.message || err);
      return res.status(err.status || 500).json({ success: false, error: err.message || "Queue update failed." });
    }
  });
});

exports.createOwnerShop = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    }
    try {
      const decoded = await requireCaller(req);
      const email = String(decoded.email || "").trim().toLowerCase();
      if (!email) return res.status(403).json({ success: false, error: "An email address is required to create a shop." });
      const body = req.body || {};
      const shopName = String(body.shopName || "").trim();
      const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (shopName.length < 2 || shopName.length > 80) {
        return res.status(400).json({ success: false, error: "Enter a shop name." });
      }
      if (slug.length < 3 || slug.length > 60 || slug === "main-st-barbers" || slug.startsWith("demo-")) {
        return res.status(400).json({ success: false, error: "That shop link is not available." });
      }
      const isSuper = email === String(SENDER_EMAIL || "").toLowerCase() || email === "senthil930@gmail.com";
      const db = admin.firestore();
      const shopRef = db.collection("shops").doc(slug);
      if ((await shopRef.get()).exists) {
        return res.status(409).json({ success: false, error: "That shop link is already taken." });
      }
      let enterprise = isSuper;
      if (!isSuper) {
        const seen = new Map();
        if (decoded.uid) {
          const byUid = await db.collection("shops").where("ownerUid", "==", decoded.uid).get();
          byUid.forEach((doc) => seen.set(doc.id, doc.data() || {}));
        }
        const byEmail = await db.collection("shops").where("ownerEmail", "==", email).get();
        byEmail.forEach((doc) => seen.set(doc.id, doc.data() || {}));
        const byLower = await db.collection("shops").where("ownerEmailLower", "==", email).get();
        byLower.forEach((doc) => seen.set(doc.id, doc.data() || {}));
        const real = [];
        seen.forEach((data, id) => {
          if (id === "main-st-barbers" || String(id).startsWith("demo-") || data.isDemoShop === true) return;
          real.push(data);
        });
        enterprise = real.some((data) => Number(data.planPrice) >= 49);
        if (!enterprise && real.length >= 1) {
          return res.status(403).json({ success: false, error: "Starter and Pro include 1 shop location. Upgrade to Enterprise for another location." });
        }
      }
      const services = Array.isArray(body.services) ? body.services.slice(0, 12).filter((service) => service && typeof service.name === "string") : [];
      const payload = {
        name: shopName,
        shopName,
        slug,
        industry: String(body.industry || "salon").slice(0, 40),
        services,
        unitLabel: String(body.unitLabel || "Stations / Chairs").slice(0, 60),
        clinicalPrivacyEnabled: !!body.clinicalPrivacyEnabled,
        estBaseWaitMin: Math.min(Math.max(parseInt(body.estBaseWaitMin, 10) || 20, 5), 180),
        hours: body.hours && typeof body.hours === "object" ? body.hours : { open: "09:00", close: "19:00", days: [1, 2, 3, 4, 5, 6, 0] },
        address: String(body.address || "").slice(0, 200),
        phone: "",
        planTitle: "Starter Tier (Free)",
        planPrice: 0,
        ownerEmail: email,
        ownerEmailLower: email,
        ownerUid: decoded.uid || "",
        queue: [],
        history: [],
        createdAt: Date.now()
      };
      const slotId = String(decoded.uid || email.replace(/[^a-z0-9]/g, "_")).slice(0, 700);
      const slotRef = db.collection("owner_shop_slots").doc(slotId);
      await db.runTransaction(async (tx) => {
        const slot = await tx.get(slotRef);
        const shopSnap = await tx.get(shopRef);
        if (shopSnap.exists) throw httpError(409, "That shop link is already taken.");
        const slotData = slot.exists ? (slot.data() || {}) : {};
        if (!isSuper && slot.exists && slotData.enterprise !== true && slotData.slug && slotData.slug !== slug && !enterprise) {
          throw httpError(403, "Starter and Pro include 1 shop location. Upgrade to Enterprise for another location.");
        }
        tx.set(shopRef, payload);
        tx.set(slotRef, {
          slug: slotData.slug || slug,
          ownerUid: decoded.uid || "",
          ownerEmail: email,
          enterprise: enterprise === true,
          updatedAt: Date.now()
        }, { merge: true });
      });
      return res.status(200).json({ success: true, slug, shopName });
    } catch (err) {
      logger.error("createOwnerShop error:", err);
      return res.status(err.status || 500).json({ success: false, error: err.message || "Could not create the shop." });
    }
  });
});

function historyTimestamp(item) {
  if (!item) return 0;
  return Number(item.checkedInAt || item.calledAt || item.completedAt || item.cancelledAt || 0) || 0;
}

async function normalizeShopOwnerEmail(doc) {
  const data = doc.data() || {};
  const email = String(data.ownerEmail || "").trim().toLowerCase();
  if (!email) return;
  if (data.ownerEmail === email && data.ownerEmailLower === email) return;
  await doc.ref.update({ ownerEmail: email, ownerEmailLower: email });
}

async function scrubTicketSecrets(db, shopRef) {
  let cursor = null;
  let scanned = 0;
  while (scanned < 1000) {
    let query = shopRef.collection("tickets").orderBy(admin.firestore.FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) return;
    cursor = snap.docs[snap.docs.length - 1];
    scanned += snap.size;
    const batch = db.batch();
    let writes = 0;
    snap.docs.forEach((entry) => {
      const data = entry.data() || {};
      if (data.phone === undefined && data.ticketSecret === undefined) return;
      batch.update(entry.ref, {
        phone: admin.firestore.FieldValue.delete(),
        ticketSecret: admin.firestore.FieldValue.delete()
      });
      writes += 1;
    });
    if (writes) await batch.commit();
    if (snap.size < 200) return;
  }
}

exports.pruneShopHistory = onSchedule({ schedule: "every 24 hours", timeoutSeconds: 300, memory: "256MiB" }, async () => {
  const db = admin.firestore();
  const shops = await db.collection("shops").limit(400).get();
  for (const doc of shops.docs) {
    try {
      await normalizeShopOwnerEmail(doc);
      await scrubTicketSecrets(db, doc.ref);
    } catch (err) {
      logger.warn("Shop maintenance skipped:", doc.id, err.message || err);
    }
    if (doc.id === "main-st-barbers" || doc.id.startsWith("demo-")) continue;
    const data = doc.data() || {};
    if (data.isDemoShop === true) continue;
    const price = Number(data.planPrice || 0);
    const days = price >= 49 ? 365 : (shopIsPaid(data) ? 90 : 7);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const history = Array.isArray(data.history) ? data.history : [];
    const kept = history.filter((item) => {
      const ts = historyTimestamp(item);
      return !ts || ts >= cutoff;
    }).slice(0, 50);
    if (kept.length !== history.length) {
      await doc.ref.update({ history: kept, updatedAt: Date.now() });
    }
    const old = await doc.ref.collection("history").where("checkedInAt", "<", cutoff).limit(200).get();
    if (old.empty) continue;
    const batch = db.batch();
    old.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
});






