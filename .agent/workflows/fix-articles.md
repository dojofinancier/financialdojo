---
description: fix-articles - Clean AI artifacts, improve heading structure, and add internal links to blog articles.
---

# Blog Article Optimization Workflow

This workflow automates the process of cleaning AI artifacts from articles, improving their SEO structure (headings), and adding semantic internal links.

## Prerequisites
- The `detectInternalLinkOpportunities` and `insertInternalLinks` actions must be available in `@/app/actions/blog`.
- `gpt-5-mini` (or latest available) must be accessible via the AI assistant.

## Steps

### 1. Identify Target Articles
Query the database for articles in the "Career" or "Study Techniques" categories that need optimization.
```sql
SELECT id, title, category FROM seo_articles WHERE category IN ('Career', 'Study Techniques');
```

### 2. Clean and Restructure (AI Task)
For each article:
- **Input**: Current article content.
- **AI Prompt**: 
  - "Remove all AI-generated 'follow-up questions', 'guidance artifacts', or meta-chat at the end of the content."
  - "Restructure the document to use a proper heading hierarchy (## for main sections, ### for subsections) instead of just plain text or bold lists."
  - "Ensure the tone is professional and consistent."
  - "Return the cleaned markdown only."

### 3. Generate Semantic Links
- Run `generateArticleEmbedding(articleId)` if not already present.
- Run `detectInternalLinkOpportunities(articleId, cleanedContent)` to find relevant articles.

### 4. Apply Changes
- Update the article in the database with the cleaned content.
- Call `insertInternalLinks` to apply the detected opportunities.

---
// turbo-all
