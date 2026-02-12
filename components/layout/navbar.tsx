import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { Button } from '@/components/ui/button'
import { UserMenu } from './user-menu'
import { Logo } from './logo'
import { CartIcon } from './cart-icon'
import { ThemeToggle } from './theme-toggle'
import { LayoutDashboard } from 'lucide-react'

export async function Navbar() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    // Silently fail - show logged out state if user fetch fails
    console.error("[Navbar] Error fetching user:", error);
    user = null;
  }

  // Serialize user object for client components
  const serializedUser = user ? {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  } : null

  // Determine dashboard URL based on role
  const getDashboardUrl = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return '/dashboard/admin'
      case 'STUDENT':
        return '/dashboard/student'
      case 'INSTRUCTOR':
        return '/dashboard/admin'
      default:
        return '/dashboard'
    }
  }

  return (
    <nav className="border-b overflow-hidden bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-2 sm:px-4 max-w-full">
        <div className="flex items-center gap-2 sm:gap-8 min-w-0 flex-shrink">
          <Logo />
        </div>

        <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
          <ThemeToggle />
          {serializedUser ? (
            <>
              {serializedUser.role === 'STUDENT' && (
                <CartIcon />
              )}
              <Link href={getDashboardUrl(serializedUser.role)} prefetch={true}>
                <Button variant="ghost" size="sm" className="p-2 sm:px-3">
                  <LayoutDashboard className="h-5 w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <UserMenu user={serializedUser} />
            </>
          ) : (
            <>
              <CartIcon />
              <Button asChild className="bg-primary hover:bg-accent text-xs sm:text-sm px-3 sm:px-4">
                <Link href="/login" prefetch={true}>Connexion</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
