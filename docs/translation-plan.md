# French to English LMS Translation Plan

## Overview

Systematic translation of the Financial Dojo LMS from French to English using OpenAI API, including URL conversion to English routes and setting up a new Supabase database.

**Scope**: All UI/pages/navigation/messages/descriptions
**Excluded**: Course content (courses, modules, quizzes, flashcards) - handled separately

---

## Phase 1: Setup Translation Infrastructure

### 1.1 Create Translation Scripts Directory

```
scripts/translation/
  extract-strings.ts        # Extract French strings from codebase
  translate-openai.ts       # Translate via OpenAI API
  apply-translations.ts     # Apply translations back to files
  translate-database.ts     # Translate database content
```

### 1.2 Install Dependencies

```bash
npm install openai dotenv
```

### 1.3 Create OpenAI Translation Utility

File: `scripts/translation/translate-openai.ts`
- Batch translation with context
- Rate limiting for API calls
- JSON output format for consistency
- Cost tracking (estimate ~$5-15 for full translation)
- **Model policy**: Use `gpt-5-mini` only for all OpenAI API calls (never use GPT-4 models)

---

## Phase 2: Route/URL Conversion

### 2.1 Folder Renames

| French Folder | English Folder |
|---------------|----------------|
| `app/tableau-de-bord/` | `app/dashboard/` |
| `app/formations/` | `app/courses/` |
| `app/apprendre/` | `app/learn/` |
| `app/cohorte/` | `app/cohort/` |
| `app/paiement/` | `app/payment/` |
| `app/panier/` | `app/cart/` |
| `app/a-propos/` | `app/about/` |
| `app/politique-de-confidentialite/` | `app/privacy-policy/` |
| `app/termes-et-conditions/` | `app/terms-and-conditions/` |
| `app/investisseur/` | `app/investor/` |

### 2.2 Files with Route References to Update

- `components/layout/brutalist-navbar.tsx` - Navigation links
- `components/layout/brutalist-navbar-client.tsx` - Dashboard routing
- `components/layout/footer.tsx` - Footer links
- `middleware.ts` - Public routes list
- All `app/actions/*.ts` files - `revalidatePath()` and `redirect()` calls

---

## Phase 3: UI Text Translation

### 3.1 High-Priority Files (Manual Review Recommended)

| File | Content |
|------|---------|
| `app/home-page-client.tsx` | Homepage marketing (~400 lines) |
| `app/politique-de-confidentialite/page.tsx` | Privacy policy (legal) |
| `app/termes-et-conditions/page.tsx` | Terms & conditions (legal) |
| `lib/constants/investisseur-diagnostic.ts` | Investor questionnaire |

### 3.2 Component Files with French Text

**Navigation & Layout:**
- `components/layout/brutalist-navbar-client.tsx` - "Tableau de bord", "Connexion"
- `components/layout/footer.tsx` - Footer text and links

**Dashboard:**
- `components/dashboard/student-dashboard.tsx` - Tab labels
- `components/dashboard/tabs/*.tsx` - Section content

**Error Handling:**
- `app/error.tsx` - Error messages
- `app/not-found-client.tsx` - 404 page

**Forms:**
- `app/contact/contact-page-client.tsx` - Contact form
- `components/payment/payment-form.tsx` - Payment form

### 3.3 Validation Messages (Zod Schemas)

Files in `app/actions/` with French error messages:
- `contact.ts` - "Le nom est requis", "Courriel invalide"
- `courses.ts` - "Le titre est requis", "Le prix doit..."
- `support-tickets.ts` - "Le sujet est requis"
- `cohorts.ts` - "Le titre est requis"
- `waitlist.ts` - "Email invalide"
- ~50 more action files

### 3.4 Toast Notifications

Search pattern: `toast.success(`, `toast.error(`
- `app/(auth)/login/page.tsx`
- `app/(auth)/reset-password/*.tsx`
- `app/panier/page.tsx`
- `components/profile/profile-form.tsx`
- `components/payment/*.tsx`

---

## Phase 4: Database Setup & Translation

### 4.1 Create New Supabase Project

1. Go to supabase.com and create new project
2. Note the project URL, anon key, and service role key
3. Get the connection strings (pooled and direct)

### 4.2 Configure New Environment

Create `.env.english` or update `.env` (clean database, no user data migration):
```env
NEXT_PUBLIC_SUPABASE_URL=https://[new-project].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[new-publishable-key]
SUPABASE_SECRET_KEY=[new-secret-key]
DATABASE_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
STRIPE_SECRET_KEY=[new-stripe-secret]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[new-stripe-publishable]
STRIPE_WEBHOOK_SECRET=[new-stripe-webhook-secret]
NEXT_PUBLIC_GA_MEASUREMENT_ID=[new-ga-measurement-id]
OPENAI_API_KEY=[openai-api-key]
```

### 4.2.1 Make Webhook URLs

Add all Make webhook URLs for the English site to `.env.english` (use separate endpoints from French):
```env
MAKE_WEBHOOK_*=[english-webhook-url]
```

### 4.3 Run Migrations on New Database

```bash
npx prisma migrate deploy
npx prisma db push
```

### 4.4 Database Content to Translate

| Table | Fields | Priority |
|-------|--------|----------|
| `course_categories` | name, description | HIGH |
| `course_faqs` | question, answer | MEDIUM |
| `cohort_faqs` | question, answer | MEDIUM |
| `blog_articles` | title, content, excerpt, metaDescription | MEDIUM |

### 4.5 Database Translation Script

File: `scripts/translation/translate-database.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const sourcePrisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const targetPrisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function translateText(text: string, context: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [{
      role: "user",
      content: `Translate this French text to English for a financial education platform. Context: ${context}\n\nText: "${text}"`
    }]
  });
  return response.choices[0].message.content || text;
}

async function translateCourseCategories() {
  const categories = await sourcePrisma.courseCategory.findMany();

  for (const category of categories) {
    const translatedName = await translateText(category.name, "course category name");
    const translatedDesc = category.description
      ? await translateText(category.description, "course category description")
      : null;

    await targetPrisma.courseCategory.create({
      data: {
        // Do not spread IDs/timestamps into clean DB
        name: translatedName,
        description: translatedDesc
      }
    });
  }
  console.log(`Translated ${categories.length} course categories`);
}

async function translateCourseFAQs() {
  const faqs = await sourcePrisma.courseFAQ.findMany();

  for (const faq of faqs) {
    const translatedQuestion = await translateText(faq.question, "FAQ question");
    const translatedAnswer = await translateText(faq.answer, "FAQ answer");

    await targetPrisma.courseFAQ.create({
      data: {
        // Do not spread IDs/timestamps into clean DB
        question: translatedQuestion,
        answer: translatedAnswer
      }
    });
  }
  console.log(`Translated ${faqs.length} FAQs`);
}

async function main() {
  console.log('Starting database translation...');

  await translateCourseCategories();
  await translateCourseFAQs();
  // Add more tables as needed

  console.log('Database translation complete!');
  await sourcePrisma.$disconnect();
  await targetPrisma.$disconnect();
}

main().catch(console.error);
```

---

## Phase 5: Implementation Steps

### Step 1: Create Translation Scripts
- [ ] Create `scripts/translation/` directory
- [ ] Create OpenAI translation utility
- [ ] Create string extraction script
- [ ] Test with a small file

### Step 2: Rename Route Folders
- [ ] Rename all French route folders to English
- [ ] Update all internal route references
- [ ] Update middleware.ts public routes
- [ ] Test all routes work

### Step 3: Translate UI Strings
- [ ] Extract all French strings to JSON
- [ ] Translate via OpenAI API
- [ ] Review translations (especially legal pages)
- [ ] Apply translations to source files

### Step 4: Translate Server-Side Messages
- [ ] Update Zod validation messages
- [ ] Update toast notifications
- [ ] Update error messages in actions

### Step 5: Setup English Database
- [ ] Create new Supabase project
- [ ] Run Prisma migrations
- [ ] Translate database content
- [ ] Verify data integrity

### Step 6: Testing
- [ ] Test all routes
- [ ] Test authentication flow
- [ ] Test form submissions
- [ ] Test payment flow (if applicable)
- [ ] Review all translated text

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Homepage content | `app/home-page-client.tsx` |
| Navigation | `components/layout/brutalist-navbar-client.tsx` |
| Footer | `components/layout/footer.tsx` |
| Auth messages | `app/actions/auth.ts` |
| Database schema | `prisma/schema.prisma` |
| Middleware routes | `middleware.ts` |
| Questionnaire data | `lib/constants/investisseur-diagnostic.ts` |
| Privacy policy | `app/politique-de-confidentialite/page.tsx` |
| Terms & conditions | `app/termes-et-conditions/page.tsx` |

---

## Complete File Inventory

### Files with French Validation Messages (app/actions/)
- `appointments.ts`
- `availability-rules.ts`
- `cohort-faqs.ts`
- `cohort-messages.ts`
- `cohorts.ts`
- `contact.ts`
- `content-items.ts`
- `courses.ts`
- `exams.ts`
- `group-coaching-sessions.ts`
- `payments.ts`
- `support-tickets.ts`
- `waitlist.ts`

### Files with French Toast Messages
- `app/(auth)/login/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(auth)/reset-password/confirm/reset-password-confirm-client.tsx`
- `app/contact/contact-page-client.tsx`
- `app/panier/page.tsx`
- `components/profile/profile-form.tsx`
- `components/payment/payment-history-list.tsx`
- `components/payment/payment-form.tsx`
- `components/cohort/group-coaching-sessions.tsx`

### Files with French UI Labels
- `app/home-page-client.tsx` (extensive)
- `app/error.tsx`
- `app/not-found-client.tsx`
- `app/contact/contact-page-client.tsx`
- `app/investisseur/questionnaire/questionnaire-client.tsx`
- `app/paiement/paiement-page-client.tsx`
- `components/dashboard/student-dashboard.tsx`
- `components/layout/brutalist-navbar-client.tsx`
- `components/layout/footer.tsx`

---

## Verification Checklist

- [ ] All routes accessible with English URLs
- [ ] No French text visible in UI
- [ ] Error messages display in English
- [ ] Form validations show English messages
- [ ] Legal pages fully translated
- [ ] Database content translated
- [ ] Authentication flow works
- [ ] Navigation links correct
- [ ] Footer links work
- [ ] Contact form submits successfully
- [ ] Payment flow works (if testing)

---

## Notes & Considerations

1. **Legal pages**: Consider professional review for translated legal documents (privacy policy, terms & conditions)

2. **Brand name**: "Le Dojo Financier" may need an English branding decision (e.g., "Financial Dojo")

3. **Email templates**: Check Supabase auth email templates for French text - these are configured in Supabase dashboard under Authentication > Email Templates

4. **SEO**: Update meta descriptions and page titles in all page.tsx files

5. **OpenAI API costs**: Estimated ~$5-15 for full translation depending on content volume

6. **Stripe**: If using Stripe, check for French error messages in payment handling

7. **Third-party services**: Review any other integrations for language settings
