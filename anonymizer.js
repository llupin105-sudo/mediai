/**
 * anonymizer.js
 * Pipeline d'anonymisation des données médicales.
 * Conforme RGPD + Code de la santé publique L.1111-8
 */

class TokenMap {
  constructor() {
    this.map = new Map();
    this.reverse = new Map();
    this.counters = {};
  }

  getOrCreate(category, value) {
    if (this.reverse.has(value)) return this.reverse.get(value);
    this.counters[category] = (this.counters[category] || 0) + 1;
    const token = `[${category}_${String(this.counters[category]).padStart(3, '0')}]`;
    this.map.set(token, value);
    this.reverse.set(value, token);
    return token;
  }

  restore(text) {
    let result = text;
    for (const [token, value] of this.map.entries()) {
      result = result.replaceAll(token, value);
    }
    return result;
  }
}

const PATTERNS = [
  {
    name: 'NIR',
    regex: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/g,
    category: 'NIR',
  },
  {
    name: 'RPPS',
    regex: /\b(?:RPPS\s*:?\s*)?\d{11}\b/g,
    category: 'RPPS',
  },
  {
    name: 'DATE_NAISSANCE',
    regex: /\bné(?:e)?\s+le\s+\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi,
    category: 'DATE_NAISS',
  },
  {
    name: 'DATE',
    regex: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b/g,
    category: 'DATE',
  },
  {
    name: 'NOM_PATIENT_FORMULE',
    regex: /\b(?:patient(?:e)?|M\.|Mme\.?|Monsieur|Madame)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,2})\b/g,
    category: 'PATIENT',
    captureGroup: 1,
  },
  {
    name: 'NOM_COLON',
    regex: /\b(?:Nom\s*:\s*)([A-ZÀ-Ÿ][A-ZÀ-Ÿa-zà-ÿ\-]+)/g,
    category: 'NOM',
    captureGroup: 1,
  },
  {
    name: 'NOM_MEDECIN',
    regex: /\b(?:D(?:r|octeur|octeure)\.?\s+)([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)?)\b/g,
    category: 'MEDECIN',
    captureGroup: 1,
  },
  {
    name: 'TEL',
    regex: /\b(?:0|\+33\s?)[1-9](?:[\s.\-]?\d{2}){4}\b/g,
    category: 'TEL',
  },
  {
    name: 'EMAIL',
    regex: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    category: 'EMAIL',
  },
  {
    name: 'ADRESSE',
    regex: /\b\d{1,4}(?:\s+(?:bis|ter))?\s+(?:rue|avenue|boulevard|impasse|chemin|allée|place|route)\s+[^,\n.]{3,40}/gi,
    category: 'ADRESSE',
  },
  {
    name: 'CP',
    regex: /\b(?:75|77|78|91|92|93|94|95|0[1-9]|[1-9]\d)\d{3}\b/g,
    category: 'CP',
  },
];

function anonymize(text) {
  const tokenMap = new TokenMap();
  let result = text;
  const stats = { replacements: 0, categories: {} };

  for (const pattern of PATTERNS) {
    result = result.replace(pattern.regex, (match, ...groups) => {
      const valueToTokenize = pattern.captureGroup
        ? groups[pattern.captureGroup - 1]
        : match;

      if (!valueToTokenize || valueToTokenize.trim().length < 2) return match;

      const token = tokenMap.getOrCreate(pattern.category, valueToTokenize.trim());
      stats.replacements++;
      stats.categories[pattern.category] = (stats.categories[pattern.category] || 0) + 1;

      if (pattern.captureGroup) return match.replace(valueToTokenize, token);
      return token;
    });
  }

  return { anonymized: result, tokenMap, stats };
}

function deanonymize(claudeResponse, tokenMap) {
  return tokenMap.restore(claudeResponse);
}

const test = `Consultation du 15/06/2024 pour Mme Isabelle MARTIN née le 03/04/1978.
NSS : 2 78 04 75 123 456 78. Adressée par Dr. Bernard LEFEBVRE.
Tel : 06 12 34 56 78. Email : i.martin@gmail.com.
Douleurs lombaires depuis 3 semaines. HTA sous amlodipine 5mg.
Lasègue négatif, contracture L4-L5. Pas de déficit neuro.
Prescription : ibuprofène 400mg x3/j, kiné 10 séances, AT 5 jours.
Dr. Émile ROUSSEAU — RPPS 10003456789 — 14 rue de la Paix, 75002 Paris`;

const { anonymized, tokenMap, stats } = anonymize(test);
console.log('TEXTE ANONYMISÉ (envoyé à Claude) :\n' + anonymized);
console.log('\nStats:', stats);
console.log('\nTokens (restent sur OVHcloud) :');
for (const [t, v] of tokenMap.map.entries()) console.log(`  ${t} => "${v}"`);

module.exports = { anonymize, deanonymize, TokenMap };
