'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Github, Mail, GraduationCap } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    console.log('GitHub login clicked')
    setIsLoading(false)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    console.log('Google login clicked')
    setIsLoading(false)
  }

  const handleORCIDLogin = async () => {
    setIsLoading(true)
    console.log('ORCID login clicked')
    setIsLoading(false)
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
          <div className="space-y-3">
            <Button
              onClick={handleGitHubLogin}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <Mail className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            <Button
              onClick={handleORCIDLogin}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              <GraduationCap className="mr-2 h-4 w-4" />
              Continue with ORCID
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