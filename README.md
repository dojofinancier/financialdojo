# Le Dojo Financier - Learning Management System

A Next.js 16 LMS platform for financial education with hybrid payment model, comprehensive content types, and full analytics. Built with TypeScript, Prisma, Supabase (Auth + Postgres), Stripe payments, and deployed on Netlify.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 24.0.0
- npm or yarn
- Supabase account and project
- Stripe account (for payments)

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Set up environment variables (see .env.example)
# DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY, etc.

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

### Build for Production

```bash
# Generate Prisma client and build
npm run db:generate
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
Dojo_Financier_App/
├── app/                          # Next.js App Router directory
│   ├── (auth)/                   # Authentication routes (login, reset-password)
│   ├── (dashboard)/              # Dashboard routes (protected)
│   │   └── dashboard/
│   │       ├── admin/            # Admin panel routes
│   │       │   ├── analytics/    # Analytics dashboard
│   │       │   ├── appointments/ # Appointment management
│   │       │   ├── cohorts/      # Cohort management
│   │       │   ├── courses/      # Course management
│   │       │   ├── students/     # Student management
│   │       │   └── ...
│   │       ├── student/          # Student dashboard
│   │       ├── profile/          # User profile
│   │       └── payments/         # Payment history
│   ├── actions/                  # Server actions (data mutations)
│   │   ├── auth.ts              # Authentication actions
│   │   ├── courses.ts            # Course-related actions
│   │   ├── enrollments.ts        # Enrollment actions
│   │   ├── payments.ts           # Payment processing
│   │   └── ...
│   ├── api/                      # API routes
│   │   └── webhooks/             # Webhook handlers (Stripe, etc.)
│   ├── formations/              # Course catalog (French)
│   ├── learn/                    # Learning interface
│   ├── checkout/                 # Checkout flow
│   ├── paiement/                 # Payment pages (French)
│   └── ...
│
├── components/                   # React components
│   ├── admin/                    # Admin-specific components
│   ├── analytics/                # Analytics components
│   ├── auth/                     # Authentication components
│   ├── course/                   # Course-related components
│   ├── dashboard/                # Dashboard components
│   ├── layout/                   # Layout components (navbar, footer)
│   ├── payment/                   # Payment components
│   ├── profile/                  # Profile components
│   └── ui/                       # Reusable UI components (shadcn/ui)
│
├── lib/                          # Utility libraries and helpers
│   ├── auth/                     # Authentication utilities
│   │   ├── get-current-user.ts   # Get current authenticated user
│   │   └── require-auth.ts       # Auth middleware
│   ├── constants/                # App constants
│   ├── hooks/                    # Custom React hooks
│   ├── prisma.ts                 # Prisma client instance
│   ├── supabase/                 # Supabase client utilities
│   │   ├── client.ts             # Client-side Supabase
│   │   ├── server.ts             # Server-side Supabase
│   │   └── middleware.ts         # Middleware utilities
│   ├── stripe/                   # Stripe integration
│   ├── utils/                    # General utilities
│   │   ├── cn.ts                 # className utility
│   │   ├── format.ts             # Formatting utilities
│   │   └── ...
│   └── webhooks/                 # Webhook utilities
│
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma             # Prisma schema definition
│   ├── seed.ts                   # Database seeding script
│   └── rls-policies.sql          # Row Level Security policies
│
├── public/                       # Static assets
│   ├── logo_dark.png             # Dark mode logo
│   ├── logo_light.png            # Light mode logo
│   └── *.PNG                     # Screenshots and images
│
├── scripts/                      # Utility scripts
│   ├── bulk-enroll-users.ts      # Bulk user enrollment
│   ├── create-admin-user.ts      # Create admin user
│   ├── generate-course-slugs.ts  # Generate course slugs
│   └── ...
│
├── templates/                    # CSV templates for data import
│   └── learning-activities/      # Learning activity templates
│
├── docs/                         # Documentation files
│   ├── investor_lp.md            # Investor landing page content
│   ├── questionnaire_investor.md # Investor questionnaire
│   └── ...
│
├── quiz/                         # Quiz data files
│   ├── *.json                    # Quiz JSON files
│   └── *.csv                     # Quiz CSV files
│
├── .cursor/                      # Cursor IDE configuration (gitignored)
├── chats/                        # Chat history (gitignored)
│
├── middleware.ts                 # Next.js middleware (auth, redirects)
├── next.config.ts                # Next.js configuration
├── netlify.toml                  # Netlify deployment configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
└── global.css                    # Global styles
```

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL) with Prisma ORM
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Netlify

### Key Features

#### Content Management
- **Courses**: Structured learning paths with modules and content items
- **Modules**: Organize course content into logical sections
- **Content Types**: Videos (Vimeo), Quizzes, Flashcards, Notes, Learning Activities
- **Progress Tracking**: Track user progress through courses and content

#### Payment System
- **One-time purchases**: Direct course purchases
- **Subscriptions**: Recurring payment model for course access
- **Stripe Integration**: Secure payment processing
- **Webhooks**: Automated enrollment and subscription management

#### User Management
- **Roles**: Student, Admin, Instructor
- **Profiles**: Extended user profiles with Prisma
- **Enrollments**: Course access management with expiration dates
- **Cohorts**: Group-based learning with instructor support

#### Analytics & Reporting
- **Student Analytics**: Progress tracking, quiz scores, time spent
- **Admin Analytics**: Course completion rates, revenue, user engagement
- **Performance Monitoring**: Query performance and error logging

#### Learning Features
- **Study Plans**: Automated study plan generation
- **Smart Review**: Spaced repetition system
- **Flashcards**: Interactive flashcard system with difficulty tracking
- **Quizzes**: Multiple question types with scoring
- **Learning Activities**: Various interactive activity types

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Netlify Deployment

The project is configured for Netlify deployment with:
- Next.js plugin (`@netlify/plugin-nextjs`)
- Automatic Prisma client generation during build
- Node.js 24 environment

Build command: `npm run db:generate && npm run build`

## 📝 Scripts

```bash
# Development
npm run dev              # Start development server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes (dev)
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database

# Production
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## 🗄️ Database

The application uses Prisma as the ORM with Supabase PostgreSQL. Key models include:

- **User**: Extended Supabase auth profiles
- **Course**: Course definitions with pricing and access rules
- **Module**: Course module organization
- **ContentItem**: Polymorphic content items (videos, quizzes, etc.)
- **Enrollment**: User-course relationships
- **Subscription**: Stripe subscription tracking
- **ProgressTracking**: User progress per content item
- **QuizAttempt**: Quiz completion tracking
- **FlashcardStudySession**: Flashcard learning sessions

See `prisma/schema.prisma` for the complete schema.

## 🔐 Authentication

Authentication is handled by Supabase Auth with:
- Email/password authentication
- Password reset flow
- Role-based access control (RBAC)
- Server-side and client-side auth utilities

## 💳 Payments

Stripe integration handles:
- One-time course purchases
- Subscription-based access
- Webhook processing for payment events
- Automatic enrollment on successful payment

## 🚨 Common Issues & Solutions

### Build Errors

1. **Prisma Client Not Generated**
   ```bash
   npm run db:generate
   ```

2. **TypeScript Errors**
   ```bash
   npm run lint
   ```

3. **Missing Environment Variables**
   - Ensure all required `.env.local` variables are set
   - Check Netlify environment variables for production

### Database Issues

1. **Migration Errors**
   ```bash
   npm run db:migrate
   ```

2. **Schema Out of Sync**
   ```bash
   npm run db:push  # For development only
   ```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)

## 📄 License

Private project - All rights reserved

---

**Last Updated**: January 2025
