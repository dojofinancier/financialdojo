import { getCurrentUser } from '@/lib/auth/get-current-user'
import { CartIcon } from '@/components/layout/cart-icon'
import { Button } from '@/components/ui/button'
import { LayoutDashboard } from 'lucide-react'
import { UserMenu } from '@/components/layout/user-menu'
import Link from 'next/link'

export async function FormationsNavbar() {
  const user = await getCurrentUser()

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

  if (serializedUser) {
    return (
      <>
        {serializedUser.role === 'STUDENT' && (
          <div className="[&_a_button]:text-white [&_a_button]:hover:bg-white/10 [&_a_button_svg]:text-white [&_span]:bg-white/20 [&_span]:text-white">
            <CartIcon />
          </div>
        )}
        <Link href={getDashboardUrl(serializedUser.role)} prefetch={true}>
          <Button variant="ghost" size="sm" className="p-2 sm:px-3 text-white hover:bg-white/10">
            <LayoutDashboard className="h-5 w-5 sm:mr-2" />
            <span className="hidden sm:inline">Tableau de bord</span>
          </Button>
        </Link>
        <div className="[&_button]:text-white [&_button]:hover:bg-white/10">
          <UserMenu user={serializedUser} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="[&_a_button]:text-white [&_a_button]:hover:bg-white/10 [&_a_button_svg]:text-white [&_span]:bg-white/20 [&_span]:text-white">
        <CartIcon />
      </div>
      <Button asChild className="bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm px-3 sm:px-4 border border-white/20">
        <Link href="/login" prefetch={true}>Connexion</Link>
      </Button>
    </>
  )
}




