FR_EN = {
    "Quiz introuvable": "Quiz not found",
    "Examen introuvable": "Exam not found",
    "Tentative introuvable": "Attempt not found",
    "Accès aux corrections non autorisé": "Corrections access not authorized",
    "Erreur lors du chargement des corrections": "Failed to load corrections",
    "Erreur lors du chargement de la tentative": "Failed to load attempt",
    "Erreur lors de la soumission": "Failed to submit",
    "Veuillez répondre à toutes les questions": "Please answer all questions",
    "Réussi": "Passed",
    "Échoué": "Failed",
    "Voir les réponses": "View answers",
    "Masquer": "Hide",
    "Chargement": "Loading",
    "Tentatives précédentes": "Previous attempts",
    "Votre réponse": "Your answer",
    "Réponse correcte": "Correct answer",
    "Explication": "Explanation",
    "fr-CA": "en-CA",
}

from pathlib import Path

files = [
    r"C:\Users\User\Desktop\financial_dojo\app\actions\exam-taking.ts",
    r"C:\Users\User\Desktop\financial_dojo\components\course\exam-list.tsx",
    r"C:\Users\User\Desktop\financial_dojo\components\course\exam-results.tsx",
]

for fp in files:
    p = Path(fp)
    text = p.read_text(encoding="utf-8")
    for fr, en in FR_EN.items():
        text = text.replace(fr, en)
    p.write_text(text, encoding="utf-8")
    print("patched", p.name)
