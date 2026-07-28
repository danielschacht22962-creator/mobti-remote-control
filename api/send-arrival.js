export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    res.status(500).json({ ok: false, error: 'OneSignal environment variables missing' });
    return;
  }

  try {
    const {
      sessionId,
      title = 'Arrival Cue',
      body = 'An arrival cue was triggered.',
      data = {}
    } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ ok: false, error: 'Missing sessionId' });
      return;
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: {
          external_id: [sessionId]
        },
        headings: {
          en: title
        },
        contents: {
          en: body
        },
        data,
        ios_sound: 'default'
      })
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      res.status(response.status).json({
        ok: false,
        error: json.errors || json.error || json.message || 'OneSignal request failed'
      });
      return;
    }

    res.status(200).json({ ok: true, result: json });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Unexpected server error' });
  }
}
