/**
 * services/transcription.js
 * Isole la transcription audio (actuellement OpenAI Whisper).
 *
 * ⚠️ Point de conformité sensible : l'audio brut d'une consultation (voix +
 * noms prononcés) part ici NON anonymisé. Pour la mise en conformité HDS,
 * ce module est celui à remplacer par une transcription auto-hébergée
 * (Whisper open-source sur l'infra HDS) ou un STT UE — sans toucher au reste.
 */

/**
 * @returns {Promise<string>} le texte transcrit
 * @throws {Error} err.code === 'NOT_CONFIGURED' si le service n'est pas configuré
 */
async function transcribeAudio({ buffer, mimetype, filename }) {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('Transcription audio non configurée côté serveur');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype }), filename || 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'fr');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.text || '';
}

module.exports = { transcribeAudio };
