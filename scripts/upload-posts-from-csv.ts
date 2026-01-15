/**
 * Upload articles from CSV export to seo_articles table
 * 
 * Usage:
 *   npx tsx scripts/upload-posts-from-csv.ts [--course=COURSE_CODE] [--dry-run]
 * 
 * Example:
 *   npx tsx scripts/upload-posts-from-csv.ts --course=negp
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface CSVRow {
  title: string;
  date: string;
  content: string;
  permalink: string;
  postType: string;
  categories: string;
  tags: string;
  slug: string;
}

// Parse CSV with proper handling of quoted multi-line fields
function parseCSV(content: string): CSVRow[] {
  const rows: CSVRow[] = [];
  const lines = content.split(/\r?\n/);
  
  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1);
  }
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  // Normalize header names (remove BOM, trim, handle case)
  const normalizedHeaders = headers.map(h => {
    let normalized = h.trim().replace(/^\ufeff/, '');
    // Map common variations
    if (normalized.toLowerCase() === 'title') return 'title';
    if (normalized.toLowerCase() === 'date') return 'date';
    if (normalized.toLowerCase() === 'content') return 'content';
    if (normalized.toLowerCase() === 'permalink') return 'permalink';
    if (normalized.toLowerCase() === 'post type') return 'postType';
    if (normalized.toLowerCase() === 'categories') return 'categories';
    if (normalized.toLowerCase() === 'tags') return 'tags';
    if (normalized.toLowerCase() === 'slug') return 'slug';
    return normalized;
  });
  
  // Find column indices
  const titleIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'title');
  const dateIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'date');
  const contentIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'content');
  const permalinkIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'permalink');
  const postTypeIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'posttype' || h.toLowerCase() === 'post type');
  const categoriesIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'categories');
  const tagsIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'tags');
  const slugIdx = normalizedHeaders.findIndex(h => h.toLowerCase() === 'slug');
  
  // Parse rows (handle multi-line quoted fields)
  let i = 1;
  while (i < lines.length) {
    const row: Partial<CSVRow> = {};
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let line = lines[i];
    
    // Continue reading until we have a complete row
    while (i < lines.length) {
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        if (char === '"') {
          if (nextChar === '"') {
            // Escaped quote
            currentField += '"';
            j++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      // If we're still in quotes, the field continues on the next line
      if (inQuotes) {
        currentField += '\n';
        i++;
        if (i < lines.length) {
          line = lines[i];
        } else {
          break;
        }
      } else {
        // Complete row
        if (currentField.trim()) {
          fields.push(currentField.trim());
        }
        break;
      }
    }
    
    // Map fields to row object
    if (titleIdx >= 0 && fields[titleIdx]) row.title = fields[titleIdx];
    if (dateIdx >= 0 && fields[dateIdx]) row.date = fields[dateIdx];
    if (contentIdx >= 0 && fields[contentIdx]) row.content = fields[contentIdx];
    if (permalinkIdx >= 0 && fields[permalinkIdx]) row.permalink = fields[permalinkIdx];
    if (postTypeIdx >= 0 && fields[postTypeIdx]) row.postType = fields[postTypeIdx];
    if (categoriesIdx >= 0 && fields[categoriesIdx]) row.categories = fields[categoriesIdx];
    if (tagsIdx >= 0 && fields[tagsIdx]) row.tags = fields[tagsIdx];
    if (slugIdx >= 0 && fields[slugIdx]) row.slug = fields[slugIdx];
    
    // Only add row if it has required fields
    if (row.title && row.slug) {
      rows.push(row as CSVRow);
    }
    
    i++;
  }
  
  return rows;
}

// Parse a single CSV line (for header)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }
  
  // Add last field
  if (currentField.trim() || inQuotes) {
    fields.push(currentField.trim());
  }
  
  return fields;
}

// Parse tags string (comma-separated) into array
function parseTags(tagsStr: string): string[] {
  if (!tagsStr) return [];
  return tagsStr
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

// Convert Unix timestamp to Date
function unixTimestampToDate(timestamp: string): Date {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return new Date();
  }
  return new Date(ts * 1000);
}

// Extract excerpt from content (first 200 characters, strip HTML)
function extractExcerpt(content: string, maxLength: number = 200): string {
  if (!content) return '';
  
  // Remove HTML tags
  const text = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (text.length <= maxLength) return text;
  
  // Find last space before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

// Calculate word count
function calculateWordCount(content: string): number {
  if (!content) return 0;
  
  // Remove HTML tags and count words
  const text = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

async function main() {
  const args = process.argv.slice(2);
  const options: { course?: string; dryRun?: boolean } = {};
  
  // Parse command line arguments
  for (const arg of args) {
    if (arg.startsWith('--course=')) {
      options.course = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }
  
  // Validate course if provided
  let course: { code: string | null; title: string } | null = null;
  
  if (options.course) {
    // Verify course exists
    const foundCourse = await prisma.course.findFirst({
      where: {
        OR: [
          { code: options.course },
          { code: options.course.replace('-', '_') },
          { code: options.course.replace('_', '-') },
        ],
      },
      select: { code: true, title: true },
    });
    
    if (!foundCourse || !foundCourse.code) {
      console.error(`❌ Error: Course "${options.course}" not found`);
      console.error('\nAvailable courses:');
      const courses = await prisma.course.findMany({
        where: { published: true },
        select: { code: true, title: true },
      });
      courses.forEach(c => {
        console.error(`  - ${c.code}: ${c.title}`);
      });
      process.exit(1);
    }
    
    course = foundCourse;
    console.log(`📚 Using course: ${course.code || 'N/A'} - ${course.title}`);
  } else {
    console.log(`📚 No course specified (course field will be null)`);
  }
  console.log(`🔍 Mode: ${options.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will insert articles)'}\n`);
  
  // Read CSV file
  const csvPath = path.join(process.cwd(), 'Posts-Export-2026-January-15-0959.csv');
  console.log(`📖 Reading CSV file: ${csvPath}`);
  
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);
  
  console.log(`✅ Parsed ${rows.length} articles from CSV\n`);
  
  if (rows.length === 0) {
    console.log('⚠️  No articles found in CSV');
    return;
  }
  
  // Process articles
  let success = 0;
  let skipped = 0;
  let errors = 0;
  const errorDetails: Array<{ slug: string; error: string }> = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const progress = `[${i + 1}/${rows.length}]`;
    
    try {
      console.log(`${progress} Processing: ${row.title.substring(0, 60)}...`);
      
      // Check if article already exists
      const existing = await prisma.blogArticle.findUnique({
        where: { slug: row.slug },
      });
      
      if (existing) {
        console.log(`  ⏭️  Skipped (already exists)`);
        skipped++;
        continue;
      }
      
      // Prepare article data
      const publishedAt = unixTimestampToDate(row.date);
      const tags = parseTags(row.tags);
      const excerpt = extractExcerpt(row.content);
      const wordCount = calculateWordCount(row.content);
      
      const articleData = {
        slug: row.slug,
        course: course?.code ?? null,
        title: row.title,
        h1: row.title, // Use title as H1 if not specified
        content: row.content,
        excerpt: excerpt || null,
        tags: tags,
        category: row.categories || null,
        targetMarket: 'investors', // User specified "investisseurs" = investors
        status: 'published',
        published: true,
        isIndexable: true,
        publishedAt: publishedAt,
        wordCount: wordCount,
      };
      
      if (options.dryRun) {
        console.log(`  ✅ Would create article: ${row.slug}`);
        console.log(`     Title: ${row.title.substring(0, 50)}...`);
        console.log(`     Tags: ${tags.length} tags`);
        console.log(`     Word count: ${wordCount}`);
        success++;
      } else {
        // Insert article
        await prisma.blogArticle.create({
          data: articleData,
        });
        
        console.log(`  ✅ Created: ${row.slug}`);
        success++;
      }
    } catch (error) {
      errors++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errorDetails.push({ slug: row.slug, error: errorMsg });
      console.error(`  ❌ Error: ${errorMsg}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`  ✅ ${options.dryRun ? 'Would create' : 'Created'}: ${success}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('='.repeat(60));
  
  if (errorDetails.length > 0) {
    console.log('\n❌ Error Details:');
    errorDetails.forEach(({ slug, error }) => {
      console.log(`  - ${slug}: ${error}`);
    });
  }
  
  if (options.dryRun) {
    console.log('\n💡 This was a dry run. Use without --dry-run to actually insert articles.');
  } else {
    console.log('\n✅ Articles uploaded successfully!');
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
