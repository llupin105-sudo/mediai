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
  }
};

module.exports = { PROMPTS, BASE_SYSTEM };
