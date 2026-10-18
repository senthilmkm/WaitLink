const fs = require('fs');
const path = require('path');

async function sendEmail() {
  const secretsPath = path.join(__dirname, '..', 'functions', 'secrets.json');
  if (!fs.existsSync(secretsPath)) {
    console.error('secrets.json not found');
    process.exit(1);
  }

  const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
  const brevoApiKey = secrets.brevo_api_key;
  if (!brevoApiKey) {
    console.error('Brevo API key not found in secrets.json');
    process.exit(1);
  }

  const universalWhatsAppContent = `🏢👥 *Quick question for any business owner with walk-in customers:*

When customers walk in, see a crowded lobby or waiting area, and have no idea how long the wait is... up to 30% quietly turn around and walk away to a competitor.

We built *WaitLink* (https://waitlink.app) to stop this invisible revenue leak:

• 🌐 *1. Google Maps, Yelp & Birdeye Direct Links:* Add your direct WaitLink queue link to your Google Business Profile, Yelp, or website. Customers can join the line *before* they even leave their home or office!
• 📋 *2. Front Desk & Lobby QR Posters:* Place a printable QR stand on your reception desk, front counter, or lobby easel. Walk-ins simply scan with their phone camera upon entering and join the queue in 2 seconds.
• 📱 *3. Zero Customer App Downloads:* No apps to install or account passwords to remember—it opens instantly in their phone's mobile browser.
• ⏱️ *4. Real-Time Phone Tracker:* Walk-ins see their live position in line ("2nd in line") and an estimated wait time updating live on their phone.
• ☕ *5. Freedom to Wait Anywhere:* Patients, diners, drivers, or clients can wait in their car, grab a coffee, or walk nearby instead of congesting your front lobby.
• 📲 *6. 1-Tap Automated SMS Alerts:* Front desk taps 1 button to text the customer: "Your table / chair / exam room / service bay is ready!"
• 🛑 *7. Cuts Front Desk Interruptions by 80%:* Eliminates repetitive "How much longer?" questions so staff can focus on high-value hospitality and service.
• ⚡ *8. 10-Second Fast Intake:* Receptionists or hosts can also check people in within seconds using any existing laptop, iPad, tablet, or smartphone.
• 💻 *9. Zero Hardware to Buy:* No expensive $1,500 kiosk screens or proprietary hardware—runs 100% on the screens you already own.
• 🆓 *10. 100% Free Starter Tier:* No credit card required, zero contracts, and takes under 2 minutes to generate your custom branded front desk QR poster.

👉 *Try the 30-second live demo on your phone right now:*
https://waitlink.app/?shop=main-st-barbers`;

  const fullTextContent = `================================================================================
WAITLINK™ — UNIVERSAL OUTREACH PITCH & PRODUCT HUNT LAUNCH KIT
Generated: ${new Date().toISOString()}
Target: senthil930@gmail.com
Production URL: https://waitlink.app
Demo URL: https://waitlink.app/?shop=main-st-barbers
================================================================================

PART 1: CRISPY 10-LINER FOR WHATSAPP GROUPS & DIRECT OUTREACH
(Fits: Auto Shops, Restaurants, Clinics, Salons, Barbers, All Walk-In Businesses)
--------------------------------------------------------------------------------
${universalWhatsAppContent}

================================================================================
PART 2: PRODUCT HUNT LAUNCH CONTENT
--------------------------------------------------------------------------------
Product Name: WaitLink
Tagline: Zero-hardware smart waitlist & SMS dispatch for walk-in shops
Primary URL: https://waitlink.app
Live Demo: https://waitlink.app/?shop=main-st-barbers
Pricing: Free Starter Tier, $15/mo Pro, $49/mo Enterprise

Tweetable Pitch (Under 280 chars):
Stop losing 20–30% of walk-ins to crowded lobbies and paper clipboards. WaitLink gives barbers, salons, clinics, and restaurants a modern digital waitlist with live phone tracking and 1-tap SMS alerts. Zero app downloads. Zero hardware to buy.

================================================================================
PART 3: THE DUAL ENTRY ADVANTAGE (ONLINE + FRONT DESK / LOBBY)
--------------------------------------------------------------------------------
1. ONLINE ENTRY (Google Profile, Yelp, Birdeye, Website):
   Customers reserve their spot before leaving home, arriving just in time.

2. LOBBY & FRONT DESK ENTRY (Printable Branded QR Counter Stand):
   Walk-in customers walking into the shop simply point their camera at the
   counter or lobby poster and join the live queue without waiting to speak
   to an overwhelmed receptionist.
================================================================================
`;

  const base64Attachment = Buffer.from(fullTextContent, 'utf8').toString('base64');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
        .container { max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); color: #ffffff; padding: 32px 28px; text-align: center; }
        .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
        .header p { margin: 0; color: #94a3b8; font-size: 14px; }
        .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; }
        .content { padding: 28px; }
        .content h2 { font-size: 18px; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 16px; font-size: 14px; }
        .bullet-item { margin-bottom: 10px; font-size: 14px; line-height: 1.5; }
        .highlight-box { background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; }
        .whatsapp-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; font-family: monospace; font-size: 13px; color: #166534; white-space: pre-wrap; word-break: break-word; }
        .cta-btn { display: inline-block; background: #10b981; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="badge">WAITLINK™ MARKETING & OUTREACH</div>
          <h1>Universal 10-Liner & Product Hunt Kit</h1>
          <p>For Auto Shops, Restaurants, Clinics & All Walk-In Businesses</p>
        </div>
        <div class="content">
          <p>Hi Senthil,</p>
          <p>Here is your finalized, universal 10-bullet pitch and Product Hunt copy ready for WhatsApp groups, direct merchant outreach, and community launch.</p>
          
          <div class="highlight-box">
            <strong>⭐ Key Superpower Included:</strong>
            <p style="margin: 6px 0 0 0;">
              <strong>Google Maps, Yelp & Birdeye Direct Links:</strong> Business owners can publish their WaitLink queue link directly on their Google Business Profile, allowing customers to join the line before leaving their home or office!
            </p>
          </div>

          <h2>📲 Ready-to-Copy WhatsApp Group 10-Liner:</h2>
          <div class="whatsapp-box">${universalWhatsAppContent}</div>

          <h2>🚀 Product Hunt Listing Highlights:</h2>
          <div class="card">
            <strong>Tagline:</strong> Zero-hardware smart waitlist & SMS dispatch for walk-in shops<br>
            <strong>Categories:</strong> Productivity, SaaS, Small Business, Customer Communication, Web Apps<br>
            <strong>Live Demo:</strong> <a href="https://waitlink.app/?shop=main-st-barbers">https://waitlink.app/?shop=main-st-barbers</a><br>
            <strong>One-Pager:</strong> <a href="https://waitlink.app/pitch.html">https://waitlink.app/pitch.html</a>
          </div>

          <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
            📎 A plain text file (<code>WAITLINK_UNIVERSAL_OUTREACH_AND_PRODUCT_HUNT_KIT.txt</code>) is attached to this email for fast copy-pasting on mobile or laptop.
          </p>
        </div>
        <div class="footer">
          WaitLink — Smart Walk-In Queue & Digital Lobby<br>
          Sent via Brevo Transactional REST API
        </div>
      </div>
    </body>
    </html>
  `;

  const payload = {
    sender: {
      name: "WaitLink",
      email: "senthil930@gmail.com"
    },
    to: [
      {
        email: "senthil930@gmail.com",
        name: "Senthil"
      }
    ],
    subject: "WaitLink — Universal 10-Liner Outreach & Product Hunt Content",
    htmlContent: htmlContent,
    textContent: fullTextContent,
    attachment: [
      {
        name: "WAITLINK_UNIVERSAL_OUTREACH_AND_PRODUCT_HUNT_KIT.txt",
        content: base64Attachment
      }
    ]
  };

  console.log('Sending universal pitch email via Brevo REST API v3...');
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey.trim(),
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Brevo Response Status:', response.status);
    console.log('Brevo Response Data:', JSON.stringify(data, null, 2));

    if (response.ok && (data.messageId || data.id)) {
      console.log('SUCCESS: Email sent successfully! Message ID:', data.messageId || data.id);
    } else {
      console.error('FAILED to send email via Brevo:', data);
      process.exit(1);
    }
  } catch (err) {
    console.error('Network / Request Error:', err);
    process.exit(1);
  }
}

sendEmail();
