/**
 * services/email.js
 * Isole l'envoi d'emails transactionnels (actuellement Resend).
 *
 * Point d'isolation : changer de fournisseur (ex. fournisseur UE, ou SMTP
 * auto-hébergé pour la conformité) se fait ICI. Aucune donnée sensible ne
 * doit transiter en clair dans le corps de l'email ; seule une pièce jointe
 * chiffrée/PDF est transmise.
 */

/**
 * Envoie un compte-rendu médical (PDF) par email.
 * @throws {Error} err.code === 'NOT_CONFIGURED' si le service n'est pas configuré
 */
async function sendReportEmail({ recipientEmail, pdfBase64, senderName, resume }) {
  if (!process.env.RESEND_API_KEY) {
    const err = new Error("Envoi d'email non configuré côté serveur");
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MédiIA <onboarding@resend.dev>', // adresse de test Resend, sans domaine à vérifier
      to: [recipientEmail],
      subject: `Compte-rendu médical — ${resume || 'consultation'}`,
      html: `
        <div style="font-family: sans-serif; color: #16211c;">
          <p>Bonjour,</p>
          <p>Vous trouverez ci-joint un compte-rendu médical transmis par <strong>${senderName}</strong> via MédiIA.</p>
          <p style="font-size: 13px; color: #8b968e;">Document confidentiel à caractère médical, soumis au secret médical et au RGPD.</p>
        </div>
      `,
      attachments: [{
        filename: 'compte-rendu-mediai.pdf',
        content: pdfBase64,
      }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur d'envoi Resend (${res.status}) ${errText}`);
  }

  return true;
}

module.exports = { sendReportEmail };
