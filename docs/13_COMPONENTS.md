# 13 — COMPONENTS

Inventaire des composants UI de MediAI. Source : `mediai-site/index.html` (app médecin) et `patient.html` (portail). Avant de créer un composant, chercher ici s'il existe déjà. Tous doivent respecter le [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md).

> Note d'architecture front : le frontend est un **monofichier** par univers (pas de composants « fichiers » réutilisables). Les « composants » sont des blocs CSS + fonctions `render*()` JS. Cet inventaire sert de carte pour les retrouver et les réutiliser.

---

## App médecin (`index.html`)

### Navigation & shell
| Composant | Classes / fonctions | Rôle |
|---|---|---|
| Sidebar | `.sidebar-*`, `.brand`, nav `data-view` | Navigation principale, réductible (250 → 64 px + tooltips) |
| Zone de compte | `renderAccountZone`, `.account-*` | Profil + menu (footer sidebar) |
| Vues applicatives | `switchAppView()`, `.app-view`, `data-view` | Bascule dashboard / patients / consultation / docs / IA / paramètres |
| Command palette ⌘K (premium) | `.cmdk-*`, `runCommandPaletteSearch`, `cmdkCommands`, `cmdkMatch`, `renderCmdkResults`, `#cmdkFoot` | Spotlight : commandes (création + navigation) avec alias + patients + documents, présélection, indices clavier |

### Dashboard
| Composant | Classes / fonctions |
|---|---|
| Salutation | `renderDashGreeting`, `.dash-greeting` |
| Panneau « Aujourd'hui » | `#dashTodaySection`, `.dash-today-*` |
| Statistiques | `.dash-stat-card`, `.dash-stats` |
| Raccourcis | `.dash-shortcut-card`, `.dash-shortcuts-grid` |
| Fil d'activité | `.dash-activity-*`, `.activity-*` |
| Barre d'usage / quota | `renderUsageBar` |

### Patient & dossier
| Composant | Classes / fonctions |
|---|---|
| Liste patients | `renderPatientsList`, `showPatientsListView`, `#patientsListView` |
| Sélecteur de patient | `renderPatientSelectorBar` |
| Hero fiche patient | `renderPatientHero`, `#patientDetailView` |
| **Patient Snapshot** (Phase 5) | `renderPatientSnapshot`, `fetchPatientSnapshot`, `refreshPatientSnapshot`, `#patientSnapshotCard` — synthèse intelligente / portrait du patient (narratif, problèmes, vigilance, suivi) |
| **Consultation Cockpit** (Sprint 2) | `renderCockpit`, `fillCockpitBriefing`, `#consultationCockpit`, classes `.ckpt-*` — briefing en tête de dossier : hero premium, « Préparer ma consultation » (récit IA), rappels, évolution, temps gagné. Déterministe instantané + récit caché. Helpers `humanizeElapsed` / `estimateTimeSaved` / `CKPT_TYPE` |
| **Documents importants** (Sprint 2.2) | `renderKeyDocuments`, `#keyDocuments`, classes `.kd-*` — le plus récent de chaque type remonte automatiquement |
| **Lecture 30 s** (Sprint 2.2) | `openQuickRead` — vue distillée aux éléments critiques (modale). Bouton dans le hero du Cockpit |
| **Recherche clinique** (Sprint 2.2) | `runPatientSearch` (sémantique, existant) + `renderSearchExamples` / `runClinicalExample` (exemples cliquables), `#searchExamples`, classes `.search-ex` |
| **Timeline** | `renderTimeline`, `renderTimelineFilters`, `TL_TYPES`, `#patientTimeline` — frise colorée par type, filtres, animation d'entrée (`tl-anim`) |
| **Consultation prête** (Sprint 3) | `renderConsultReadyPanel`, `#consultReadyPanel`, classes `.cr-*` — orchestration ambient après le CR : ordonnance/courrier en un clic (réutilise `openOrdonnanceModal`/`openCourrierModal`), suites à donner, constantes |
| **Évolution des constantes** (Sprint 3.2) | `renderVitalsEvolutionHtml`, `VITALS`, `vitalsSparkline`, `vitalsTrend`, `firstNum` — carte du Cockpit : sparklines SVG des constantes lues sur les consultations. 100 % déterministe |
| **Signaux & alertes** (Sprint 4) | `computePatientSignals` (moteur déterministe : suivi dépassé, renouvellement, résultat non revu, tension élevée, absence de suivi), carte Cockpit « Signaux détectés » + `renderDashboardSignals`/`#dashSignalsSection` (panneau transversal). Helpers `parseDelayToDays`, `latestTension`, `signalDot` |
| **Home intelligente** (Intelligence Workspace) | `renderIntelligentHome`, `computeDayFacts`, `#dashIntelligentHome`, classes `.ih-*` — le dashboard raconte la journée, chaque phrase cliquable vers la bonne page |
| **Hero patient premium** (Patient Workspace) | dans `renderCockpit` : `.ckpt-heropro`/`.ckpt-glance` — avatar, médecin référent, badge de vigilance, coup d'œil. Helper `lastVital` |
| **Graphiques de constantes** (Patient Workspace) | `renderVitalsEvolutionHtml`, `vitalsMultiSvg`, `vitCard` — vrais graphiques SVG (aire + courbe + tendance), tension bi-courbe |
| **Colonne Insights** (Patient Workspace) | `renderPatientInsights`, `piwInsCard`, `#patientInsights`, `.piw-*` — rail sticky deux colonnes : vigilance, signaux, documents clés, à préparer, constantes |
| **Centre de notifications** (Intelligence Workspace) | `#notifBell`/`#notifBadge`/`#notifOverlay`, `renderNotifCenter`, `updateNotifBadge`, `NOTIF_META` — cloche sidebar + panneau iOS-like groupé (depuis la dernière visite / par jour) |
| Timeline | `renderTimeline`, `renderTimelineFilters`, `#chartSection` connexes |
| Détails d'événement (modal) | `renderConsultationDetailHtml`, `renderOrdonnanceDetailHtml`, `renderCourrierDetailHtml`, `renderLabDetailHtml`, `renderImagingDetailHtml` |
| Graphique | `renderChart`, `.chart-panel`, `.chart-section` |

### Documents & IA
| Composant | Classes / fonctions |
|---|---|
| Vues document | `renderDocView`, `data-view="doc-*"` (consultation, ordonnance, courrier, labo, imagerie) |
| Lignes d'ordonnance | `renderOrdonnanceLines` |
| Bandeau anonymisation | `.anon-strip` |
| Export | `.btn-export` |

### Feedback & états
| Composant | Classes / fonctions |
|---|---|
| Toasts | `showToast`, `.toast`, keyframes `toastIn/toastOut` |
| Skeletons | keyframe `skeletonShimmer` |
| États vides guidés | helper `emptyState()`, keyframe `emptyIn` |
| Auth | `.auth-*` (onglets, champs, erreurs, submit) |

### Boutons (variantes)
`.auth-submit`, `.btn-export`, `.btn-price`, `.dash-action-btn`, `.danger` — toutes à hauteur `--btn-h` (42 px). Toute nouvelle variante réutilise `--btn-*`.

---

## Portail patient (`patient.html`)

Composants **mobile-first**, volontairement plus simples et chaleureux.

| Composant | Fonctions |
|---|---|
| Écran de connexion | `submitPatientLogin`, `#loginScreen` |
| Accueil | `renderPatientHome`, `#pGreeting` |
| Traitements en cours | `renderPatientTreatments`, `#pTreatments` |
| Documents récents / liste | `renderPatientRecentDocs`, `renderPatientDocuments`, filtres `setDocFilter` |
| Timeline patient | `renderPatientTimeline`, `loadPatientTimeline` |
| Profil | `#pProfile*` |
| Tabbar (navigation basse) | `switchPatientView`, `#pTabbar` |
| Carte accent | `.p-card-warm` (dégradé bleu) |

---

## Règles pour créer un composant

1. **Chercher d'abord** un composant existant à réutiliser/étendre.
2. Respecter les tokens du [04_DESIGN_SYSTEM.md](04_DESIGN_SYSTEM.md) (couleurs sémantiques, `--btn-h`, `--r-*`, `--shadow-*`, mouvement `--dur-*`/`--ease*`).
3. Prévoir l'état **vide**, **chargement** (skeleton) et **erreur** (toast).
4. Accessibilité : focus visible, mouvement désactivable.
5. Ne pas transposer tel quel un composant entre univers médecin et patient.

> Dette connue : le frontend monofichier limite la réutilisation. Une future extraction en composants est une piste ouverte (→ [14_BACKLOG.md](14_BACKLOG.md)), non prioritaire tant que la vélocité reste bonne.
