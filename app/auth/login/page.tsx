'use client'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Github, Mail, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [isLoading, setIsLoading] = useState<'github' | 'google' | null>(null)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const next = searchParams.get('next') ?? '/dashboard'

  const signInWith = async (provider: 'github' | 'google') => {
    setIsLoading(provider)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setIsLoading(null)
      console.error(`${provider} sign-in failed:`, error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <GraduationCap className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to OpenLPM
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to collaborate on learning progressions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Sign-in failed. Please try again.
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => signInWith('github')}
              disabled={isLoading !== null}
              className="w-full"
              variant="outline"
            >
              <Github className="mr-2 h-4 w-4" />
              {isLoading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
            </Button>
            <Button
              onClick={() => signInWith('google')}
              disabled={isLoading !== null}
              className="w-full"
              variant="outline"
            >
              <Mail className="mr-2 h-4 w-4" />
              {isLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Secure authentication powered by Supabase
              </span>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
