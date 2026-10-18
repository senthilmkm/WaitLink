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

  const filePath = path.join(__dirname, '..', 'docs', 'OUTREACH_TEMPLATES_AND_VALUE_PROPS.txt');
  if (!fs.existsSync(filePath)) {
    console.error('File OUTREACH_TEMPLATES_AND_VALUE_PROPS.txt not found');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const base64Attachment = Buffer.from(fileContent, 'utf8').toString('base64');

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
        .badge { display: inline-block; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
        .content { padding: 28px; }
        .content h2 { font-size: 18px; color: #0f172a; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; font-size: 14px; }
        .card strong { color: #0f172a; }
        .highlight-box { background: rgba(99, 102, 241, 0.08); border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; }
        .cta-btn { display: inline-block; background: #6366f1; color: #ffffff !important; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; margin-top: 12px; font-size: 14px; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        ul { padding-left: 20px; margin: 8px 0; }
        li { margin-bottom: 6px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="badge">WAITLINK™ BUSINESS STRATEGY</div>
          <h1>Outreach Playbook & Value Props</h1>
          <p>Converting highly-rated store & clinic walk-in traffic into loyal customers</p>
        </div>
        <div class="content">
          <p>Hi Senthil,</p>
          <p>Attached is the complete <strong>WaitLink Outreach Playbook & Value Proposition Cheat Sheet</strong> (<code>OUTREACH_TEMPLATES_AND_VALUE_PROPS.txt</code>).</p>
          
          <div class="highlight-box">
            <strong>📦 Included in the Attached File:</strong>
            <ul>
              <li><strong>Template 1</strong>: Primary Email Outreach for Barbershops, Salons, Spas & Retail</li>
              <li><strong>Template 2</strong>: Healthcare & Clinic Specific Outreach (Urgent Care, Dental, Physio)</li>
              <li><strong>Template 3</strong>: Short & Punchy Social Media DM (Instagram, LinkedIn, Facebook)</li>
              <li><strong>Template 4</strong>: Polite, Zero-Pressure Follow-Up Note (Sent 4–5 Days Later)</li>
              <li><strong>Cheat Sheet Matrix</strong>: Pain Points vs. WaitLink Solutions vs. Dollar ROI</li>
              <li><strong>Role-by-Role Breakdown</strong>: Front Desk Staff, Business Owners, and Walk-in Customers</li>
              <li><strong>Objection Handlers</strong>: Responses to paper sign-in sheets, older demographics, and hardware costs</li>
            </ul>
          </div>

          <h2>Quick Links</h2>
          <p>
            • <strong>Production App:</strong> <a href="https://waitlink.app">https://waitlink.app</a> (Fallback: <a href="https://waitlink-app-8821.web.app">https://waitlink-app-8821.web.app</a>)<br>
            • <strong>Live Interactive Demo:</strong> <a href="https://waitlink.app/?shop=main-st-barbers">https://waitlink.app/?shop=main-st-barbers</a>
          </p>

          <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
            The complete uncompressed plain-text version is attached to this email and saved in your local repository under <code>c:\\Workspaces\\WaitLink\\docs\\OUTREACH_TEMPLATES_AND_VALUE_PROPS.txt</code>.
          </p>
        </div>
        <div class="footer">
          WaitLink — Live Walk-in Wait Time Tracker & SaaS System<br>
          Sent automatically via Brevo Transactional API
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
    subject: "WaitLink — Business Owner & Clinic Outreach Playbook & Value Props",
    htmlContent: htmlContent,
    textContent: fileContent,
    attachment: [
      {
        name: "OUTREACH_TEMPLATES_AND_VALUE_PROPS.txt",
        content: base64Attachment
      }
    ]
  };

  console.log('Sending email via Brevo REST API v3...');
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
