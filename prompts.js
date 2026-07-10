/**
 * prompts.js
 * Bibliothèque de prompts médicaux par spécialité.
 * Le texte reçu est DÉJÀ anonymisé — Claude ne voit jamais de données nominatives.
 */

const BASE_SYSTEM = `Tu es un assistant médical expert pour les professionnels de santé français.
Tu reçois des transcriptions de consultations médicales déjà anonymisées (les données nominatives ont été remplacées par des tokens comme [PATIENT_001], [MEDECIN_001], etc.).

Règles absolues :
- Ne jamais inventer ou compléter des informations non présentes dans la transcription
- Conserver EXACTEMENT les tokens d'anonymisation dans ta réponse (ne pas les supprimer ni les modifier)
- Utiliser la terminologie médicale française officielle
- En cas d'ambiguïté, utiliser la formulation "selon les dires du patient"
- Ne jamais émettre de diagnostic définitif — tu structures ce que le médecin a dit
- Ajouter [À VÉRIFIER] si une information semble incohérente`;

const PROMPTS = {

  /**
   * Médecin généraliste — format SOAP standard
   */
  generaliste: {
    system: BASE_SYSTEM + `

Tu es spécialisé en médecine générale libérale. Tu maîtrises :
- Le format SOAP (Subjectif / Objectif / Assessment / Plan) français
- La nomenclature CIM-10 pour les diagnostics
- Les ordonnances françaises (posologie, durée, mentions légales)
- Les formulaires administratifs (arrêts de travail, courriers de spécialistes)`,

    user: (transcription) => `Voici la transcription d'une consultation de médecine générale :

<transcription>
${transcription}
</transcription>

Génère un compte-rendu médical structuré au format SOAP en respectant strictement ce modèle JSON :

{
  "type": "consultation_generaliste",
  "format": "SOAP",
  "sections": {
    "subjectif": {
      "motif_principal": "motif de consultation en 1 phrase",
      "plaintes": ["liste des symptômes décrits par le patient"],
      "duree_evolution": "durée depuis quand",
      "contexte_declenchant": "facteur déclenchant si mentionné",
      "antecedents_pertinents": ["antécédents mentionnés"],
      "traitements_en_cours": ["médicaments actuels avec posologie"]
    },
    "objectif": {
      "constantes": {
        "tension": "valeur ou null",
        "pouls": "valeur ou null",
        "temperature": "valeur ou null",
        "saturation": "valeur ou null",
        "poids": "valeur ou null"
      },
      "examen_clinique": ["findings de l'examen, une ligne par système examiné"]
    },
    "assessment": {
      "diagnostic_principal": "diagnostic retenu",
      "diagnostics_secondaires": ["autres diagnostics si mentionnés"],
      "code_cim10": "code CIM-10 si identifiable",
      "signes_alarme_absents": ["signes de gravité écartés si mentionnés"]
    },
    "plan": {
      "prescriptions": [
        {
          "medicament": "nom",
          "posologie": "dose × fréquence",
          "duree": "durée",
          "voie": "orale/topique/etc"
        }
      ],
      "examens_demandes": ["examens complémentaires prescrits"],
      "orientations": ["avis spécialisés, kinésithérapie, etc."],
      "arret_travail": {
        "prescrit": true,
        "duree_jours": 0,
        "motif": ""
      },
      "education_patient": ["conseils donnés au patient"],
      "suivi": "prochaine consultation dans X semaines/si..."
    }
  },
  "resume_1_ligne": "Résumé clinique en une phrase pour le dossier",
  "mots_cles": ["3-5 mots-clés médicaux pour la recherche"]
}`
  },

  /**
   * Kinésithérapeute — bilan et séances
   */
  kinesitherapeute: {
    system: BASE_SYSTEM + `

Tu es spécialisé en kinésithérapie. Tu maîtrises :
- Les bilans fonctionnels musculo-squelettiques
- Les cotations COTAM et les actes NGAP
- Les tests cliniques (Lasègue, Jobe, Thomas, etc.)
- Les objectifs thérapeutiques et progressions de rééducation`,

    user: (transcription) => `Voici la transcription d'une séance ou d'un bilan kinésithérapique :

<transcription>
${transcription}
</transcription>

Génère un compte-rendu kinésithérapique structuré en JSON :

{
  "type": "bilan_kine",
  "motif_prescription": "pathologie prescrite par le médecin",
  "nombre_seances_prescrites": 0,
  "bilan_initial": {
    "plaintes_fonctionnelles": ["ce que le patient ne peut plus faire"],
    "eva_douleur": "score /10 ou null",
    "bilan_morphostatique": "observations posturales",
    "amplitudes_articulaires": ["mesures goniométriques si mentionnées"],
    "testing_musculaire": ["force musculaire par groupe"],
    "tests_cliniques": [
      {"test": "nom du test", "resultat": "positif/négatif/valeur"}
    ],
    "deficiences_retenues": ["déficiences principales identifiées"]
  },
  "objectifs_reeducation": {
    "court_terme": ["objectifs 2-4 séances"],
    "moyen_terme": ["objectifs fin de cure"],
    "long_terme": ["maintien à domicile"]
  },
  "techniques_utilisees": ["techniques mises en oeuvre"],
  "evolution_seance": "si compte-rendu de séance : évolution observée",
  "actes_ngap": ["cotations NGAP si identifiables"],
  "consignes_patient": ["exercices à domicile, conseils"]
}`
  },

  /**
   * Mode "résumé rapide" — pour les médecins pressés
   */
  resume_rapide: {
    system: BASE_SYSTEM,

    user: (transcription) => `Transcription de consultation :

<transcription>
${transcription}
</transcription>

Génère uniquement un résumé médical concis en format structuré :

{
  "motif": "en 5 mots max",
  "diagnostic": "diagnostic principal",
  "prescription_resume": "médicaments en 1 ligne",
  "suivi": "prochaine étape",
  "points_attention": ["alertes ou points importants"],
  "duree_consultation_estimee": "courte/standard/longue"
}`
  },

  /**
   * Courrier de correspondance — lettre à un confrère/spécialiste,
   * générée à partir d'un compte-rendu déjà structuré (pas d'une
   * nouvelle transcription brute).
   */
  courrier: {
    system: BASE_SYSTEM + `

Tu es spécialisé dans la rédaction de courriers médicaux de correspondance entre professionnels de santé français (médecin traitant → spécialiste, ou l'inverse).

Règles supplémentaires pour ce format :
- Ton formel et confraternel, comme un vrai courrier médical français ("Cher confrère,", "Je vous adresse...", "Je reste à votre disposition...")
- Reformule et synthétise les éléments cliniques du compte-rendu fourni — ne réinvente rien qui n'y figure pas
- Sois concis : un courrier médical fait rarement plus d'une page
- Termine toujours par une question ou une demande claire au confrère (avis, prise en charge, examen complémentaire)`,

    user: (compteRenduJson, motifAdressage) => `Voici un compte-rendu de consultation déjà structuré (les tokens d'anonymisation type [PATIENT_001] doivent être conservés tels quels) :

<compte_rendu>
${JSON.stringify(compteRenduJson)}
</compte_rendu>

${motifAdressage ? `Motif précis de l'adressage indiqué par le médecin : ${motifAdressage}` : "Aucun motif d'adressage précis n'a été indiqué — déduis-le du diagnostic et des orientations mentionnées dans le compte-rendu."}

Génère un courrier de correspondance médicale structuré en JSON :

{
  "destinataire_suggere": "type de spécialiste à qui adresser ce courrier, déduit du contexte (ex: 'Confrère cardiologue')",
  "objet": "objet du courrier en une ligne",
  "corps_lettre": "le texte complet du courrier, formaté en paragraphes séparés par des retours à la ligne (\\n\\n), du 'Cher confrère,' jusqu'à la formule de politesse finale incluse",
  "question_posee": "la question ou demande précise adressée au confrère, isolée pour référence rapide"
}`
  },

  /**
   * Résumé intelligent du dossier patient — synthétise la chronologie
   * des événements médicaux d'un patient en un récit cohérent, avec
   * mise en évidence des liens et évolutions notables. C'est la base
   * de la "timeline intelligente" : ne réinterprète jamais cliniquement,
   * se contente d'organiser et de relier ce qui est déjà écrit.
   */
  resume_dossier: {
    system: BASE_SYSTEM + `

Tu es spécialisé dans la synthèse de dossiers médicaux longitudinaux. Ton rôle est d'aider un médecin à retrouver rapidement le fil de l'histoire d'un patient, PAS de poser un jugement clinique nouveau.

Règles supplémentaires pour ce format :
- Ne jamais émettre de diagnostic ou d'hypothèse médicale qui ne figure pas déjà explicitement dans les événements fournis
- Relie les événements entre eux uniquement sur la base de faits explicites (ex: "le traitement introduit en mars a précédé l'amélioration notée en juin"), jamais d'inférence médicale
- Reste factuel et chronologique, à la manière d'un historique de dossier, pas d'un avis médical
- Si un suivi semble prévu ou en attente d'après les événements, signale-le simplement comme un rappel administratif`,

    user: (eventsTimelineText) => `Voici la chronologie des événements médicaux d'un patient (données déjà anonymisées) :

<chronologie>
${eventsTimelineText}
</chronologie>

Génère une synthèse structurée en JSON :

{
  "synthese_narrative": "2 à 4 phrases racontant le fil de l'histoire médicale de ce patient, en langage clair, à la manière d'un résumé de dossier",
  "liens_identifies": [
    "lien factuel explicite entre deux événements, ex: 'Le traitement anti-hypertenseur introduit en 2025 précède l'amélioration tensionnelle notée en 2026'"
  ],
  "points_attention": [
    "élément qui mérite l'attention du médecin à la prochaine consultation, basé uniquement sur les événements fournis"
  ],
  "suivi_en_attente": "rappel factuel si un suivi ou contrôle semble prévu d'après les événements, sinon null"
}`
  }
};

/**
 * Résumé intelligent de dossier patient — synthèse narrative de la
 * chronologie d'un patient (Phase 2 : "Intelligence").
 *
 * IMPORTANT : ce prompt est volontairement cadré comme un outil
 * d'ORGANISATION et de LECTURE RAPIDE du dossier, pas d'interprétation
 * clinique. Il ne doit jamais suggérer de diagnostic, seulement
 * synthétiser et relier des faits déjà présents dans le dossier.
 */
const DOSSIER_SUMMARY_PROMPT = {
  system: BASE_SYSTEM + `

Tu es spécialisé dans la synthèse de dossiers médicaux pour aider un médecin à reprendre rapidement le fil du suivi d'un patient.

Règles supplémentaires, absolues pour ce mode :
- Tu NE DIAGNOSTIQUES JAMAIS. Tu résumes et relies des faits déjà présents dans les événements fournis.
- N'invente aucune information, aucune date, aucun événement qui ne figure pas explicitement dans les données fournies.
- Reste factuel et chronologique. Les liens que tu identifies entre événements doivent être des observations temporelles ou administratives (ex: "un traitement a été introduit après tel diagnostic"), jamais des inférences cliniques nouvelles.
- Si une évolution te semble notable (amélioration, aggravation, absence de suivi), formule-le comme une observation à vérifier par le médecin, jamais comme une conclusion.
- Ce résumé est un outil d'aide à la lecture du dossier, pas un avis médical.`,

  user: (eventsJson) => `Voici la chronologie complète des événements médicaux enregistrés pour ce patient (du plus récent au plus ancien), avec les tokens d'anonymisation à conserver tels quels :

<evenements>
${JSON.stringify(eventsJson)}
</evenements>

Génère une synthèse de dossier structurée en JSON :

{
  "synthese_generale": "un paragraphe de 3-5 phrases qui raconte le parcours du patient à travers ces événements, en langage clair",
  "points_cles": ["3-6 faits marquants du dossier, un par ligne, factuels"],
  "evolution_notable": "une observation sur une évolution temporelle si elle ressort clairement des données (sinon : 'Aucune évolution notable identifiable sur la période disponible')",
  "a_verifier_par_le_medecin": ["1-3 points que le médecin pourrait vouloir vérifier ou approfondir, formulés comme des questions ouvertes, jamais comme des conclusions"],
  "timeline_annotee": [
    {"date": "date de l'événement", "titre": "titre de l'événement", "note": "courte note contextuelle de 1 phrase reliant cet événement au reste du dossier, ou vide si rien à signaler"}
  ]
}`
};

module.exports = { PROMPTS, BASE_SYSTEM, DOSSIER_SUMMARY_PROMPT };
