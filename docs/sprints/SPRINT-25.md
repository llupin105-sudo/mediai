# Sprint 25 — « One Clear Action »

## Objectif
Passe de **cohérence globale** (pas d'ajout de fonctionnalités) : faire en sorte que chaque écran principal de l'app médecin (`mediai-site/app.html`) réponde à **une seule question** et converge vers **une seule action principale**. Philosophie : *« Si un élément n'aide pas le médecin à décider ou agir maintenant, il ne doit probablement pas être visible immédiatement. »* **UI/UX uniquement** — aucune API, auth, Supabase, Render ou Vercel touchée.

Ordre validé avec le porteur : **Consultation → Documents → IA Assist**, chaque écran déployé et vérifié (non-régression Google) avant le suivant.

> Note de nommage : un « Sprint 24 » existait déjà (Patients Calm Workspace). Ce sprint est donc numéroté **25**.

---

## Increment 1 — Consultation (livré, `2ee5321`)

**Question de l'écran :** « De quoi ai-je besoin *pendant* la consultation ? »
**Action unique :** *Générer le compte-rendu.*

### Avant
La carte de capture (`.station-card`) s'ouvrait **à froid sur une ligne de facturation** (« 3 actions IA gratuites / mois »), le sélecteur patient était en **tint ambre** (lu comme une alarme alors que c'est juste l'étape 1), et « Mode Focus » occupait un **gros bouton pleine largeur** au même niveau visuel que l'action principale. Le résultat SOAP était déjà masqué jusqu'à génération (`.chart-section` `display:none` → `.visible`) — progressive disclosure déjà en place, conservée.

### Après
Un **flux vertical unique** qui converge vers « Générer » :
1. En-tête **« Consultation »** + sous-titre (« Dictez ou collez vos notes — MediAI structure le compte-rendu ») = la question de l'écran.
2. **Sélectionner un patient** — invitation calme et neutre (fin de l'ambre-alarme).
3. 🎙 **Appuyer pour dicter** (héros) · *ou coller la transcription* (textarea).
4. 💡 *Suggestions de questions* — démoté en lien secondaire discret.
5. Spécialité (Généraliste / Kiné / Résumé rapide).
6. **Générer le compte-rendu** (action primaire, désactivée tant qu'il n'y a pas de contenu).
7. Quota **chuchoté** en pied de carte (déplacé du haut).
8. « Mode Focus » : gros bouton → **pastille discrète** en haut à droite.

### Décisions
- **Zéro suppression de logique** : tous les IDs/handlers conservés (`micBtn`, `transcriptBox`, `generateBtn`, `symptomQuestionsBtn`, `usageLabel`/`usageBar`, `patientSelectorBar`, `toggleFocusMode`, autosave, export SOAP). Seuls la **structure de présentation** et le CSS changent.
- Nouveau CSS statique (toujours chargé) : `.consult-head`, `.consult-focus`, `.consult-suggest`, `.usage-strip.quiet`, `.patient-selector.empty` neutralisé.
- La barre d'export (6 boutons) du résultat n'a **pas** été touchée (post-génération, hors du cold-open ciblé).

### Tests
- Parsing JS : OK, **zéro erreur console**.
- Manuel (statique) : en-tête ✓, sélecteur neutre ✓, micro/textarea ✓, suggestion discrète ✓, spécialité ✓, Générer désactivé sans contenu ✓, quota en pied ✓, Focus pastille ✓.
- Déploiement vérifié en ligne : `consult-head`/`consult-focus`/`usage-strip quiet` présents, `micBtn`+`generateBtn` intacts, **Google Client ID intact** (aucune régression auth).

---

## Increment 2 — Documents (livré, `4af1e10`)

**Question de l'écran :** « Quels documents dois-je gérer ? »
**Verbes du cahier :** retrouver · **créer** · comprendre · ouvrir.

### Avant
L'écran (`renderDocumentCenter` → `#view-documents`) était déjà calme : en-tête + favoris (`dcFav`) + onglets par type avec compteurs (`dcTabs`, seuls les types non-vides s'affichent) + **recherche instantanée** (`dcSearch`) + liste (`dcList` : icône · titre · patient·date · étoile favori) + pagination « Voir plus ». **Manque :** aucune **action de création** (le cahier demande « créer un document »), onglet actif en **pilule navy foncée** (détonne du reste), état vide minimal.

### Après
- **Action primaire « ＋ Nouveau document »** dans l'en-tête → `openQuickCreate('document')` = flux **existant** `withPatient(openEventModal)` (choix patient puis modale document). L'écran répond enfin aux 4 verbes.
- **Onglet actif** : navy foncé → **`accent-tint`/`accent-deep`** (cohérent avec les filtres calmes du dashboard).
- **État vide enrichi** (`.dc-empty-lg`, quand aucun document hors recherche) : 🗂️ + « Aucun document pour l'instant » + explication + bouton de création.
- **Sous-titre** : correction du Title Case parasite (`.dash-date` `capitalize`, prévu pour les dates) → phrase normale.

### Décisions / tests
- **Zéro suppression** : recherche, onglets, favoris, pagination, handlers (`onDocSearch`, `setDocTab`, `toggleDocFavorite`, `renderDocList/Tabs/Favorites`) inchangés. CSS ajouté à `ensureDocCenterStyles` (`.dc-head`, `.dc-new`, `.dc-empty-lg`).
- Vérif : 5 docs → liste + onglets + compteurs ✓ ; liste vide → état vide large + CTA ✓ ; **zéro erreur console** ; en ligne `dc-new`/`dc-empty-lg`/onglet accent-tint présents, **Google Client ID intact**.

---

## Restant (à valider écran par écran)
- **IA Assist** → « Quelle aide puis-je demander ? » : actions contextuelles (Résumer / Préparer / Structurer / Compte rendu) plutôt qu'un chat isolé.
- Transversal : transitions harmonisées sur ces écrans.
