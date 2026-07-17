/**
 * scripts/drop-compte-rendus.js
 * Suppression UNIQUE et SÛRE de la table legacy `compte_rendus`.
 *
 * Le code applicatif ne crée ni n'utilise plus cette table (consolidation
 * Phase 0). Ce script la retire des bases existantes — mais SEULEMENT si
 * elle est vide, pour ne jamais détruire de données par erreur.
 *
 * Usage (contre la base de production, une seule fois) :
 *   DATABASE_URL='postgres://...' node scripts/drop-compte-rendus.js
 *
 * Voir docs/07_DATABASE.md.
 */

require('dotenv').config();
const { pool } = require('../db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL manquante — fournissez la chaîne de connexion de la base à nettoyer.');
    process.exitCode = 1;
    return;
  }

  // La table existe-t-elle encore ?
  const exists = await pool.query(`SELECT to_regclass('public.compte_rendus') AS t`);
  if (!exists.rows[0].t) {
    console.log('ℹ️  Table compte_rendus absente — rien à faire.');
    return;
  }

  // Garde-fou : on ne supprime que si elle est vide.
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM compte_rendus');
  const n = rows[0].n;
  if (n > 0) {
    console.error(`⚠️  La table compte_rendus contient ${n} ligne(s). Abandon.`);
    console.error('    Vérifiez/exportez ces données avant toute suppression manuelle.');
    process.exitCode = 1;
    return;
  }

  await pool.query('DROP TABLE IF EXISTS compte_rendus');
  console.log('✅ Table compte_rendus supprimée (elle était vide).');
}

main()
  .catch((err) => {
    console.error('Erreur :', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
