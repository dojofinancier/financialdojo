from pathlib import Path
import re

p = Path(r"C:\Users\User\Desktop\financial_dojo\components\course\module-detail-page.tsx")
text = p.read_text(encoding="utf-8")

replacements = [
    ('import { NoteContent } from "@/components/course/note-content";\n', ""),
    ("consolidatedNotesPdf?: boolean;\n", ""),
    (
        "  /** Admin-uploaded consolidated notes PDF (for download link in Notes tab) */\n"
        "  consolidatedNotesPdfUrl?: string | null;\n",
        "",
    ),
    (
        "export function ModuleDetailPage({ courseId, moduleId, onBack, componentVisibility, consolidatedNotesPdfUrl }",
        "export function ModuleDetailPage({ courseId, moduleId, onBack, componentVisibility }",
    ),
    ("  const showConsolidatedNotesDownload = !!consolidatedNotesPdfUrl;\n  \n", ""),
    (
        "  const detailedNotesPdfUrl = module?.detailedNotesPdfUrl ?? null;\n"
        "  const showDetailedNotesDownload = !!detailedNotesPdfUrl;\n",
        "  const modulePdfUrl = module?.pdfUrl ?? null;\n"
        "  const coursePdfUrl = module?.coursePdfUrl ?? null;\n"
        "  const showModulePdfDownload = !!modulePdfUrl;\n"
        "  const showCoursePdfDownload = !!coursePdfUrl;\n",
    ),
    ("detailedNotesPdfUrl", "modulePdfUrl"),
    ("showDetailedNotesDownload", "showModulePdfDownload"),
    ("showConsolidatedNotesDownload", "showCoursePdfDownload"),
    ("consolidatedNotesPdfUrl", "coursePdfUrl"),
    ("Erreur lors de la sauvegarde", "Failed to save"),
    ("Erreur lors du chargement du module", "Failed to load module"),
    ("Erreur lors du démarrage du quiz", "Failed to start quiz"),
    ("Voulez-vous marquer ce module comme complété ?", "Mark this module as completed?"),
    ("Module marqué comme complété !", "Module marked as completed!"),
    ("Erreur lors de la mise à jour", "Failed to update"),
    ("Aucune question à soumettre", "No questions to submit"),
    ("Quiz réussi ! Score:", "Quiz passed! Score:"),
    ("Erreur lors de la soumission", "Failed to submit"),
    ("Module introuvable", "Module not found"),
    ("Diapos", "Slides"),
    ("Aucune note disponible pour ce module.", "No notes available for this module."),
    ("Télécharger les notes détaillées (PDF)", "Download chapter notes (PDF)"),
    ("Télécharger les notes consolidées (PDF)", "Download consolidated notes (PDF)"),
    ("Aucun quiz disponible pour ce module.", "No quiz available for this module."),
    ("Chargez le quiz pour commencer.", "Load the quiz to get started."),
    ("Chargement...", "Loading..."),
    ("Commencer le quiz", "Start quiz"),
    ("Précédent", "Previous"),
    ("Suivant", "Next"),
    ("Soumettre le quiz", "Submit quiz"),
    ("Quiz soumis", "Quiz submitted"),
    ("Obtenez au moins", "Score at least"),
    ("au quiz 1 pour débloquer le quiz 2.", "on quiz 1 to unlock quiz 2."),
    ("au quiz 2 pour débloquer le quiz 3.", "on quiz 2 to unlock quiz 3."),
    ("Tentatives précédentes", "Previous attempts"),
    ("Historique de vos tentatives pour ce quiz", "Your attempt history for this quiz"),
    ("Tentative", "Attempt"),
    ("Réussi", "Passed"),
    ("Masquer", "Hide"),
    ("Voir les réponses", "View answers"),
    (
        "Prenez vos notes ici pendant que vous étudiez ce module...",
        "Take your notes here while studying this module...",
    ),
    ("· Tentative", "· Attempt"),
]

for old, new in replacements:
    text = text.replace(old, new)

text = re.sub(
    r"<NoteContent[\s\S]*?/>",
    '<div className="note-content prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: noteItem.note.content }} />',
    text,
    count=1,
)

p.write_text(text, encoding="utf-8")
print("patched module-detail-page")
