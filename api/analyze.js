const https = require('https');

function httpsPost(urlStr, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const body = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { reject(new Error('Parse error: ' + raw.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = 'AIzaSyDh9kJaRgmiH7cZipz3le5rMvGk7MTQ2kk';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'No image' });

    const prompt = `Kamu adalah ahli gizi. Analisis foto makanan/minuman ini.\n\nBalas HANYA JSON ini, tanpa backtick:\n{"nama_makanan":"nama","total_kalori":0,"karbohidrat_g":0,"protein_g":0,"lemak_g":0,"porsi":"estimasi","item":[{"nama":"item","porsi":"porsi","kalori":0,"karbo":0,"protein":0,"lemak":0}],"catatan":"tips"}\n\nGanti semua 0 dengan nilai estimasi. Jika bukan makanan: {"error":"Bukan makanan"}. Bahasa Indonesia.`;

    const reqBody = {
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]}],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    };

    const result = await httpsPost(GEMINI_URL, reqBody);
    if (result.status !== 200) throw new Error(result.data?.error?.message || 'Gemini error ' + result.status);

    const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return res.status(200).json({ result: clean });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
