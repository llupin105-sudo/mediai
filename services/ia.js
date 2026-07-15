/**
 * services/ia.js
 * Isole l'appel au modèle de langage (actuellement Claude / Anthropic).
 *
 * Point d'isolation volontaire : changer de modèle, de fournisseur, ou
 * router vers un modèle hébergé en UE/HDS pour les données identifiables
 * (cf. stratégie de conformité) se fait ICI, sans toucher au reste du code.
 */

// Modèle surchargeable par variable d'environnement (change sans redéploiement).
// Sonnet 4.6 = « scribe » de référence (bon rapport qualité/coût).
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

/**
 * Appel factorisé au modèle : centralise le modèle, les en-têtes, la
 * gestion d'erreur et l'extraction du JSON. Renvoie le JSON parsé (encore
 * tokenisé si l'entrée l'était) + le nombre de tokens consommés. Le caller
 * se charge de la dé-anonymisation s'il dispose d'une tokenMap.
 */
async function callClaude({ system, user, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': process.env.ANTHROPIC_API_KEY || 'YOUR_KEY_HERE',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

  const data = await res.json();
  const rawText = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  if (!rawText) throw new Error("Claude n'a renvoyé aucun texte exploitable");

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse Claude invalide');
  const json = JSON.parse(jsonMatch[0]);

  const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  return { json, tokensUsed };
}

module.exports = { callClaude, CLAUDE_MODEL };
