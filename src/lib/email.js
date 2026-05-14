const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '')

const FROM = {
  email: process.env.SENDGRID_FROM || 'noreply@achievo.app',
  name: 'Achievo',
}

const sendVerificationEmail = async (to, name, code) => {
  const msg = {
    to,
    from: FROM,
    subject: `${code} is your Achievo verification code`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:20px;border:1px solid #E8ECF4;overflow:hidden;box-shadow:0 4px 24px rgba(17,24,39,0.08);">
    <div style="background:linear-gradient(135deg,#0A1B33 0%,#0F2444 100%);padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;background:#2767FF;border-radius:10px;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>
        <span style="font-size:20px;font-weight:900;color:white;letter-spacing:-0.02em;">Achievo</span>
      </div>
    </div>

    <div style="padding:40px;">
      <h1 style="font-size:26px;font-weight:900;color:#111827;letter-spacing:-0.03em;margin:0 0 8px;">
        Verify your email
      </h1>
      <p style="color:#6B7A99;font-size:15px;line-height:1.65;margin:0 0 32px;">
        Hey ${name.split(' ')[0]}, enter the code below to confirm your account. It expires in <strong>15 minutes</strong>.
      </p>

      <div style="background:#F4F6FB;border:2px solid #E8ECF4;border-radius:16px;padding:36px 24px;text-align:center;margin-bottom:32px;">
        <div style="font-size:52px;font-weight:900;letter-spacing:0.18em;color:#2767FF;line-height:1;">${code}</div>
        <p style="color:#9DAEC5;font-size:13px;margin:12px 0 0;">Valid for 15 minutes · Do not share</p>
      </div>

      <div style="background:#FFF7F0;border:1px solid #FFD9B8;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
        <p style="color:#C45E1A;font-size:13px;margin:0;line-height:1.5;">
          🔒 Achievo will never ask for this code outside of sign-up. If you didn't create an account, ignore this email.
        </p>
      </div>

      <p style="color:#9DAEC5;font-size:13px;line-height:1.6;margin:0;">
        Questions? Reply to this email and we'll help you out.
      </p>
    </div>

    <div style="padding:20px 40px;border-top:1px solid #E8ECF4;background:#F4F6FB;">
      <p style="color:#9DAEC5;font-size:12px;margin:0;">
        © 2026 Achievo — The loyalty platform for local businesses worldwide.
      </p>
    </div>
  </div>
</body>
</html>`,
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL DEV] To: ${to} | Code: ${code}`)
    return
  }

  await sgMail.send(msg)
}

const sendRewardConfirmedEmail = async (to, name, businessName, rewardTitle, points) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://achievo.app').split(',').find(u => !u.includes('localhost')) || process.env.FRONTEND_URL || 'https://achievo.app'
  const msg = {
    to,
    from: FROM,
    subject: `🎉 Your reward at ${businessName} is ready!`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:20px;border:1px solid #E8ECF4;overflow:hidden;box-shadow:0 4px 24px rgba(17,24,39,0.08);">
    <div style="background:linear-gradient(135deg,#0A1B33 0%,#0F2444 100%);padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;background:#2767FF;border-radius:10px;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
          </svg>
        </div>
        <span style="font-size:20px;font-weight:900;color:white;letter-spacing:-0.02em;">Achievo</span>
      </div>
    </div>

    <div style="padding:40px;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:72px;height:72px;background:rgba(34,197,94,0.12);border:2px solid rgba(34,197,94,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 style="font-size:26px;font-weight:900;color:#111827;letter-spacing:-0.03em;margin:0 0 8px;">Reward unlocked!</h1>
        <p style="color:#6B7A99;font-size:15px;line-height:1.65;margin:0;">
          Hey ${name.split(' ')[0]}, your challenge was confirmed by <strong style="color:#111827;">${businessName}</strong>.
        </p>
      </div>

      <div style="background:#FFF9F0;border:1.5px solid #FFD9A8;border-radius:16px;padding:24px;margin-bottom:28px;text-align:center;">
        <p style="color:#9DAEC5;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">Your reward</p>
        <p style="font-size:22px;font-weight:900;color:#C45E1A;letter-spacing:-0.02em;margin:0 0 6px;">${rewardTitle}</p>
        ${points > 0 ? `<p style="color:#F59E0B;font-size:14px;font-weight:700;margin:0;">+${points} points added to your wallet</p>` : ''}
      </div>

      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px 18px;margin-bottom:28px;">
        <p style="color:#166534;font-size:13px;margin:0;line-height:1.5;">
          🎁 Show this to a staff member at <strong>${businessName}</strong> to claim your reward.
        </p>
      </div>

      <div style="text-align:center;">
        <a href="${frontendUrl}/wallet" style="display:inline-block;background:#2767FF;color:white;font-size:14px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:-0.01em;">
          Open my wallet →
        </a>
      </div>
    </div>

    <div style="padding:20px 40px;border-top:1px solid #E8ECF4;background:#F4F6FB;">
      <p style="color:#9DAEC5;font-size:12px;margin:0;">
        © 2026 Achievo — The loyalty platform for local businesses worldwide.
      </p>
    </div>
  </div>
</body>
</html>`,
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[EMAIL DEV] Reward confirmed — To: ${to} | Business: ${businessName} | Reward: ${rewardTitle}`)
    return
  }

  await sgMail.send(msg)
}

module.exports = { sendVerificationEmail, sendRewardConfirmedEmail }
