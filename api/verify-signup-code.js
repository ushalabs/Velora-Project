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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, username, password, code } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const trimmedUsername = `${username || ''}`.trim();
    const verificationCode = `${code || ''}`.trim();

    if (!normalizedEmail || !trimmedUsername || !password || !verificationCode) {
      res.status(400).json({ error: 'Missing signup verification details.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername) || trimmedUsername.length < 3) {
      res.status(400).json({
        error: 'Username must be at least 3 characters and use only letters, numbers, or underscores.',
      });
      return;
    }

    const pendingRef = db.collection('pendingSignups').doc(normalizedEmail);
    const pendingSnapshot = await pendingRef.get();

    if (!pendingSnapshot.exists) {
      res.status(404).json({ error: 'No verification code was found for this email.' });
      return;
    }

    const pendingSignup = pendingSnapshot.data() || {};
    if (pendingSignup.expiresAt <= Date.now()) {
      await pendingRef.delete().catch(() => {});
      res.status(400).json({ error: 'That verification code has expired.' });
      return;
    }

    if (`${pendingSignup.code || ''}` !== verificationCode) {
      res.status(400).json({ error: 'That verification code is incorrect.' });
      return;
    }

    const existingUsername = await db
      .collection('users')
      .where('usernameLower', '==', trimmedUsername.toLowerCase())
      .limit(1)
      .get();

    if (!existingUsername.empty) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }

    let createdUser;

    try {
      createdUser = await admin.auth(app).createUser({
        email: normalizedEmail,
        password,
        displayName: trimmedUsername,
        emailVerified: true,
      });
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        res.status(409).json({ error: 'That email is already registered.' });
        return;
      }
      throw error;
    }

    await db.collection('users').doc(createdUser.uid).set(
      {
        uid: createdUser.uid,
        email: normalizedEmail,
        username: trimmedUsername,
        usernameLower: trimmedUsername.toLowerCase(),
        avatar: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await pendingRef.delete().catch(() => {});

    const customToken = await admin.auth(app).createCustomToken(createdUser.uid);
    res.status(200).json({ customToken });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to verify signup code',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
