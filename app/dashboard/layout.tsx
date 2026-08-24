import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { BookOpen, GitBranch, MessageSquare, FileText, LogOut, User } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defense in depth: middleware already redirects unauthenticated
  // requests, but this covers direct server-component rendering too.
  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r p-4">
        <div className="flex items-center gap-2 mb-8">
          <GitBranch className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold">OpenLPM</h1>
        </div>

        <nav className="space-y-2">
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Overview
            </Button>
          </Link>
          <Link href="/dashboard/literature">
            <Button variant="ghost" className="w-full justify-start">
              <BookOpen className="mr-2 h-4 w-4" />
              Literature
            </Button>
          </Link>
          <Link href="/dashboard/schema">
            <Button variant="ghost" className="w-full justify-start">
              <GitBranch className="mr-2 h-4 w-4" />
              Schema
            </Button>
          </Link>
          <Link href="/dashboard/discussions">
            <Button variant="ghost" className="w-full justify-start">
              <MessageSquare className="mr-2 h-4 w-4" />
              Discussions
            </Button>
          </Link>
        </nav>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="px-2 text-xs text-muted-foreground truncate">
            {user.email}
          </div>
          <Link href="/dashboard/profile">
            <Button variant="ghost" className="w-full justify-start">
              <User className="mr-2 h-4 w-4" />
              Profile
            </Button>
          </Link>
          <form action="/auth/signout" method="post">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </aside>

      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
