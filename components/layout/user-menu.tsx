'use client'

import { logoutAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface UserMenuProps {
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    role: string
  }
}

export function UserMenu({ user }: UserMenuProps) {
  const handleSignOut = async () => {
    try {
      await logoutAction()
      toast.success("Logout successful")
      // Use hard redirect to ensure immediate navigation
      window.location.href = "/login"
    } catch (error) {
      toast.error("Error logging out")
    }
  }

  const getInitials = () => {
    const first = user.firstName?.[0] || ''
    const last = user.lastName?.[0] || ''
    if (first && last) {
      return `${first}${last}`.toUpperCase()
    }
    return user.email[0].toUpperCase()
  }

  const getDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    return user.email
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrateur'
      case 'STUDENT':
        return 'Student'
      case 'INSTRUCTOR':
        return 'Instructeur'
      default:
        return role
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs sm:text-sm">
            {getInitials()}
          </div>
          <span className="hidden md:inline">
            {getDisplayName()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {getDisplayName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              Role: {getRoleLabel(user.role)}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-xs sm:text-sm cursor-pointer">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

