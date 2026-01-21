# Translation Scripts

Workflow:

0) Replace French routes with English

```
tsx scripts/translation/replace-routes.ts
```

1) Extract French strings

```
tsx scripts/translation/extract-strings.ts
```

2) Translate with OpenAI (saves JSON for review)

```
tsx scripts/translation/translate-openai.ts
```

3) Apply translations back to files

```
tsx scripts/translation/apply-translations.ts
```

Outputs are stored in `scripts/translation/output/`.

Database translation (optional):

```
tsx scripts/translation/translate-database.ts
```

Required env vars:
- `OPENAI_API_KEY`
- `DATABASE_URL` (source)
- `DIRECT_URL` (target)

Optional env vars:
- `SOURCE_DATABASE_URL`
- `TARGET_DATABASE_URL`
