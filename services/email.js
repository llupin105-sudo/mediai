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

  // Adresse d'expéditeur configurable. Défaut = adresse de test Resend
  // (sans domaine à vérifier) ; EN PRODUCTION, définir EMAIL_FROM sur un
  // domaine vérifié. Voir docs/10_SECURITY.md.
  const fromAddress = process.env.EMAIL_FROM || 'MediAI <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
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

/**
 * Envoie un lien de réinitialisation de mot de passe (Sprint 9).
 * Le lien contient un jeton court ; aucune donnée sensible dans l'email.
 * @throws {Error} err.code === 'NOT_CONFIGURED' si le service n'est pas configuré
 */
async function sendPasswordResetEmail({ recipientEmail, resetUrl }) {
  if (!process.env.RESEND_API_KEY) {
    const err = new Error("Envoi d'email non configuré côté serveur");
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const fromAddress = process.env.EMAIL_FROM || 'MediAI <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipientEmail],
      subject: 'Réinitialisation de votre mot de passe MediAI',
      html: `
        <div style="font-family: sans-serif; color: #0A1128; max-width: 480px;">
          <p>Bonjour,</p>
          <p>Vous avez demandé à réinitialiser votre mot de passe MediAI. Ce lien est valable 30 minutes :</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background:#1460FF;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block;">Réinitialiser mon mot de passe</a>
          </p>
          <p style="font-size: 13px; color: #48566E;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe reste inchangé.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur d'envoi Resend (${res.status}) ${errText}`);
  }
  return true;
}

module.exports = { sendReportEmail, sendPasswordResetEmail };
