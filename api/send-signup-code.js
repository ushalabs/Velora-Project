const admin = require('firebase-admin');

const app =
  admin.apps[0] ||
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

const db = admin.firestore(app);

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const generateCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }

    if (!process.env.RESEND_API_KEY || !process.env.AUTH_EMAIL_FROM) {
      res.status(500).json({
        error: 'Signup email service is not configured yet.',
      });
      return;
    }

    try {
      await admin.auth(app).getUserByEmail(normalizedEmail);
      res.status(409).json({ error: 'That email is already registered.' });
      return;
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const code = generateCode();
    const now = Date.now();

    await db.collection('pendingSignups').doc(normalizedEmail).set({
      email: normalizedEmail,
      code,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      updatedAt: now,
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM,
        to: [normalizedEmail],
        subject: 'Your Velora verification code',
        html: `
          <div style="font-family:Arial,sans-serif;padding:24px;background:#faf5ff;color:#1f1334">
            <h2 style="margin:0 0 12px;color:#6d28d9">Velora</h2>
            <p style="margin:0 0 16px">Use this verification code to finish creating your account:</p>
            <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0;color:#4c1d95">${code}</div>
            <p style="margin:16px 0 0">This code expires in 10 minutes.</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const emailError = await emailResponse.text();
      res.status(502).json({
        error: 'Failed to send verification code.',
        details: emailError,
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send signup code',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
