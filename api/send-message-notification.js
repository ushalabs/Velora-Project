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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';

    if (!idToken) {
      res.status(401).json({ error: 'Missing auth token' });
      return;
    }

    const decoded = await admin.auth(app).verifyIdToken(idToken);
    const senderId = decoded.uid;
    const { conversationId, senderName, previewText } = req.body || {};

    if (!conversationId || !previewText) {
      res.status(400).json({ error: 'Missing notification payload' });
      return;
    }

    const conversationSnapshot = await db.collection('conversations').doc(conversationId).get();
    if (!conversationSnapshot.exists) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = conversationSnapshot.data() || {};
    const memberIds = Array.isArray(conversation.memberIds) ? conversation.memberIds : [];
    const recipientIds = memberIds.filter((memberId) => memberId !== senderId);

    if (recipientIds.length === 0) {
      res.status(200).json({ success: true, delivered: 0 });
      return;
    }

    const userSnapshots = await Promise.all(
      recipientIds.map((recipientId) => db.collection('users').doc(recipientId).get())
    );

    const tokens = userSnapshots.flatMap((snapshot) => {
      const data = snapshot.data() || {};
      return Array.isArray(data.expoPushTokens) ? data.expoPushTokens : [];
    });

    if (tokens.length === 0) {
      res.status(200).json({ success: true, delivered: 0 });
      return;
    }

    const title =
      conversation.type === 'group'
        ? `${senderName} in ${conversation.title || 'Group'}`
        : senderName || 'New message';

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: previewText,
      data: { conversationId },
    }));

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoData = await expoResponse.json();
    res.status(200).json({
      success: expoResponse.ok,
      delivered: tokens.length,
      expo: expoData,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send notification',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
