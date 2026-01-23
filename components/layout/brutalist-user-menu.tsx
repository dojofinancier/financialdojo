'use client'

import { logoutAction } from '@/app/actions/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface BrutalistUserMenuProps {
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    role: string
  }
}

export function BrutalistUserMenu({ user }: BrutalistUserMenuProps) {
  const handleSignOut = async () => {
    try {
      await logoutAction()
      toast.success("Logout successful")
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
        <button
          className="bg-white text-black font-black uppercase text-sm tracking-wider px-4 py-2 border-4 border-white hover:bg-black hover:text-white transition-colors flex items-center gap-2"
        >
          <div className="flex h-6 w-6 items-center justify-center border-2 border-black bg-black text-white text-xs font-black">
            {getInitials()}
          </div>
          <span className="hidden sm:inline">{getDisplayName()}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white border-4 border-black">
        <DropdownMenuLabel className="border-b-4 border-black pb-2">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-black uppercase leading-none">
              {getDisplayName()}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate font-mono">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground font-mono uppercase">
              Role: {getRoleLabel(user.role)}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-black" />
        <DropdownMenuItem 
          onClick={handleSignOut} 
          className="text-xs sm:text-sm cursor-pointer font-black uppercase hover:bg-black hover:text-white"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

