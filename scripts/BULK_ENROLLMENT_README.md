# Bulk User Enrollment Script

This script allows you to mass enroll users to specific courses from a Google Sheets export (CSV format).

## Features

- ✅ Creates users in Supabase Auth automatically
- ✅ Syncs users to Prisma database
- ✅ Enrolls users in courses (by slug, code, or ID)
- ✅ Generates random passwords if not provided
- ✅ Handles existing users gracefully (updates password if provided)
- ✅ Skips duplicate enrollments (if user is already enrolled and access is still valid)
- ✅ Provides detailed progress and error reporting

## CSV Format

Export your Google Sheets data as CSV with the following columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `firstName` | No | User's first name | `John` |
| `lastName` | No | User's last name | `Doe` |
| `email` | **Yes** | User's email address | `john@example.com` |
| `courseIdentifier` | **Yes** | Course slug, code, or ID | `ccvm-1` or `CCVM-2` or UUID |
| `password` | No | Password for the user. If empty, a random password will be generated | `MySecurePass123` |

### Example CSV

```csv
firstName,lastName,email,courseIdentifier,password
John,Doe,john.doe@example.com,ccvm-1,
Jane,Smith,jane.smith@example.com,CCVM-2,MySecurePass123
Bob,Johnson,bob@example.com,ccvm-1,AnotherPassword456
```

### Multiple Enrollments for Same User

**You can have multiple rows with the same email for different courses!** The script handles this correctly:

- ✅ **Same user, different courses**: Creates separate enrollments for each course
- ✅ **Same user, same course**: Skips duplicate enrollment if access is still valid
- ✅ **User account**: Created once (first time email is seen), updated on subsequent rows

**Example - User enrolled in 2 courses:**
```csv
firstName,lastName,email,courseIdentifier,password
John,Doe,john@example.com,ccvm-1,
John,Doe,john@example.com,ccvm-2,
```

This will:
1. Create John's account on the first row
2. Enroll John in `ccvm-1`
3. Update John's account (if needed) on the second row
4. Enroll John in `ccvm-2`

**Note**: If you provide different passwords for the same email, the last password in the CSV will be used.

## Usage

1. **Export your Google Sheets data as CSV**
   - In Google Sheets: File → Download → Comma-separated values (.csv)
   - Save the file (e.g., `enrollments.csv`)

2. **Run the script**
   ```bash
   npx tsx scripts/bulk-enroll-users.ts enrollments.csv
   ```

   Or with an absolute path:
   ```bash
   npx tsx scripts/bulk-enroll-users.ts /path/to/enrollments.csv
   ```

## Course Identifier

The `courseIdentifier` column can contain:
- **Course Slug**: The URL-friendly identifier (e.g., `ccvm-1`)
- **Course Code**: The course code (e.g., `CCVM-2`)
- **Course ID**: The UUID of the course

The script will try to find the course in this order:
1. By UUID (if the identifier looks like a UUID)
2. By slug
3. By code

## Password Generation

If the `password` column is empty, the script will:
- Generate a random 12-character password
- Include the generated password in the output summary
- **Important**: Save the generated passwords! They won't be stored anywhere else.

## What the Script Does

For each row in the CSV:

1. **Validates** required fields (email, courseIdentifier)
2. **Generates password** if not provided
3. **Finds the course** by slug, code, or ID
4. **Creates/updates user** in Supabase Auth:
   - If user exists (same email seen before): Updates password (if provided) and metadata
   - If user doesn't exist: Creates new user with auto-confirmed email
5. **Syncs user** to Prisma database (uses upsert, so safe for multiple rows)
6. **Creates enrollment**:
   - Sets expiration date based on course `accessDuration`
   - Skips if user is already enrolled in **this specific course** and access is still valid
   - **Allows multiple enrollments** for the same user to different courses

### Handling Multiple Enrollments

When the same email appears multiple times:
- **First occurrence**: Creates user account, syncs to database, creates enrollment
- **Subsequent occurrences**: Updates user (if password/metadata changed), creates additional enrollment for the new course
- The script tracks this and shows `(enrollment #2 for this user)` in the output

## Output

The script provides:
- ✅ Real-time progress for each user
- 📊 Summary with success/failed/skipped counts
- 🔑 List of generated passwords (if any)
- ❌ Detailed error messages for failed rows

### Example Output

```
📋 Processing 4 enrollment(s)...

[1/4] Processing: john.doe@example.com
  🔍 Looking up course: ccvm-1
  ✅ Found course: CCVM 1 - Introduction (ccvm-1)
  🔐 Creating/updating user in Supabase...
  ✅ User created in Supabase
  🔄 Syncing to Prisma...
  ✅ User synced to Prisma (ID: abc123...)
  📝 Creating enrollment for course: CCVM 1 - Introduction...
  ✅ Enrollment created (expires: 2025-12-31)

[2/4] Processing: john.doe@example.com (enrollment #2 for this user)
  🔍 Looking up course: ccvm-2
  ✅ Found course: CCVM 2 - Advanced (ccvm-2)
  🔐 User already exists, updating if needed...
  ✅ User account updated (existing user)
  📝 Creating enrollment for course: CCVM 2 - Advanced...
  ✅ Enrollment created (expires: 2025-12-31)

[3/4] Processing: jane.smith@example.com
  🔍 Looking up course: CCVM-2
  ✅ Found course: CCVM 2 - Advanced (CCVM-2)
  🔐 Creating/updating user in Supabase...
  ✅ User created in Supabase
  🔄 Syncing to Prisma...
  ✅ User synced to Prisma (ID: def456...)
  📝 Creating enrollment for course: CCVM 2 - Advanced...
  ✅ Enrollment created (expires: 2025-12-31)

[4/4] Processing: bob@example.com
  🔍 Looking up course: invalid-course
  ❌ Course not found

============================================================
📊 SUMMARY
============================================================
✅ Successful: 3
⚠️  Skipped (already enrolled): 0
❌ Failed: 1

🔑 Generated Passwords:
------------------------------------------------------------
john.doe@example.com: xK9#mP2$vL8q

❌ Errors:
------------------------------------------------------------
Row 4 (bob@example.com): Course not found: invalid-course

✨ Done!
```

## Environment Variables

Make sure you have these environment variables set:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SECRET_KEY` - Your Supabase secret key (for admin operations)

## Error Handling

The script handles:
- ✅ Missing or invalid CSV files
- ✅ Invalid email addresses
- ✅ Courses not found
- ✅ Duplicate enrollments (skips if already enrolled)
- ✅ Existing users (updates instead of failing)
- ✅ Network/database errors

## Tips

1. **Test with a small CSV first** (2-3 rows) before processing large batches
2. **Save generated passwords** - they're shown in the output but not stored
3. **Use course slugs** when possible - they're more readable than UUIDs
4. **Check the summary** - review errors before considering the job complete
5. **Backup your data** - always have a backup before bulk operations

## Troubleshooting

### "Course not found" error
- Verify the course exists in your database
- Check that the course identifier matches exactly (case-sensitive for codes)
- Try using the course UUID instead

### "Failed to create user in Supabase" error
- Check your Supabase credentials
- Verify the email format is valid
- Check Supabase dashboard for rate limits

### "User already exists" (not an error)
- This is normal - the script will update the existing user
- Password will be updated if provided in CSV

## Security Notes

- ⚠️ The service role key has admin access - keep it secure
- ⚠️ Generated passwords are shown in console output - clear console after use
- ⚠️ CSV files may contain sensitive data - delete after processing
- ✅ Users are created with `email_confirm: true` (no email verification needed)
- ✅ Passwords are securely stored in Supabase Auth
