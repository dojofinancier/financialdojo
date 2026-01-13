# Architecture recommandée — Diagnostic Investisseur
## Supabase + Pages personnalisées

Cette architecture permet de générer **une page de rapport personnalisée par utilisateur** sans maintenir 49 pages distinctes.
Le principe central repose sur :
- 1 squelette de rapport
- des blocs de contenu modulaires
- un moteur d’assemblage basé sur le profil principal + secondaire

---

## Principe général

- Le rapport est composé de **sections fixes**
- Chaque section contient **des blocs conditionnels**
- Les blocs sont sélectionnés selon :
  - le profil principal
  - le profil secondaire
  - la combinaison exacte (fallback intelligent)

---

## Tables de référence (stables)

### `investor_archetypes`
Définit les archétypes d’investisseurs.

- `id` (pk) — ex: `stratege`, `optimiseur`
- `name` — ex: *Le Stratège*
- `one_liner`
- `description_short` (optionnel)

---

### `investor_combos`
Représente toutes les combinaisons possibles (primaire + secondaire).

- `id` (pk) — ex: `stratege__optimiseur`, `stratege__none`
- `primary_id` (fk → investor_archetypes.id)
- `secondary_id` (fk → investor_archetypes.id, nullable)
- `label` (optionnel)

> Total possible : 49 lignes (7 profils × 7 états incluant “none”).

---

### `report_templates`
Versionne les modèles de rapports.

- `id` (pk) — ex: `investor_report_v1`
- `name`
- `version`
- `is_active`

---

### `report_sections`
Définit la structure du rapport.

- `id` (pk)
- `template_id` (fk → report_templates.id)
- `key` — ex: `executive_summary`, `primary_profile`, `mistakes`
- `title`
- `sort_order`
- `render_mode` — `markdown` | `html`

---

### `report_blocks`
Blocs de contenu conditionnels (cœur du système).

- `id` (pk)
- `template_id` (fk)
- `section_key`
- `audience` — ex: `investor`
- `primary_id` (nullable)
- `secondary_id` (nullable)
- `combo_id` (nullable, optionnel)
- `priority` (int)
- `content_md` (text) ou `content_json` (jsonb)
- `variables_schema` (jsonb)
- `is_active`

#### Règles d’usage
- Bloc générique : `primary_id = NULL` et `secondary_id = NULL`
- Bloc par profil principal : `primary_id = 'stratege'`
- Bloc combo exact : `primary_id = 'stratege' AND secondary_id = 'optimiseur'`

---

## Tables d’exécution (par utilisateur)

### `leads`
Informations de base sur l’utilisateur.

- `id` (pk)
- `first_name`
- `email`
- `age_range` (nullable)
- `created_at`

---

### `assessments`
Résultat du questionnaire.

- `id` (pk)
- `lead_id` (fk → leads.id)
- `template_id`
- `primary_id`
- `secondary_id` (nullable)
- `combo_id` (fk → investor_combos.id)
- `scores` (jsonb)
- `created_at`

---

### `assessment_answers`
Réponses détaillées au questionnaire.

- `id` (pk)
- `assessment_id` (fk)
- `question_id`
- `answer_id`

---

### `report_instances`
Rapport généré et accessible via lien unique.

- `id` (pk)
- `assessment_id` (fk)
- `template_id` (fk)
- `rendered_md` ou `rendered_html`
- `rendered_at`
- `public_token` (unique)
- `expires_at` (nullable)

> Cette table permet :
> - de figer une version du rapport
> - d’éviter un recalcul à chaque affichage
> - de gérer des liens temporaires

---

## Flux de génération du rapport

1. L’utilisateur complète le questionnaire
2. Le système calcule :
   - profil principal
   - profil secondaire
   - `combo_id`
3. Création des enregistrements :
   - `lead`
   - `assessment`
   - `assessment_answers`
4. Génération du rapport :
   - récupération des sections du template
   - sélection des blocs (combo → primaire → secondaire → générique)
   - injection des variables
   - assemblage en Markdown ou HTML
5. Sauvegarde dans `report_instances`
6. Envoi d’un email avec un lien unique :
   - `/r/{public_token}`

---

## Format recommandé

### Format principal
- **Page web personnalisée**
- Contenu stocké en **Markdown**
- Rendu HTML côté front

### Format secondaire (optionnel)
- PDF généré à la demande à partir du Markdown

---

## Accès et sécurité

- Accès via `public_token` unique
- Expiration optionnelle du lien
- RLS activé sur toutes les tables internes
- Aucune authentification requise pour consulter un rapport public

---

## Résumé

- 1 squelette de rapport
- des blocs modulaires par profil
- 49 combinaisons possibles sans duplication
- système versionnable, mesurable et prêt pour un futur SAAS / AI advisor
