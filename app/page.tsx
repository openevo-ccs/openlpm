import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, GitBranch, MessageSquare, Search, Users, Lock, Globe } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">OpenLPM</h1>
          </div>
          <nav className="flex gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/login">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Collaborative Learning Progression Management
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          A cost-free, scientifically rigorous platform for collaborative development of learning progressions
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/login">
            <Button size="lg" className="text-lg">
              Start Collaborating
            </Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline" className="text-lg">
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Search className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Literature Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Search, verify, and organize scientific literature with DOI verification and evidence linking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <GitBranch className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Schema Co-Design</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Collaboratively design and refine learning progression schema elements with version tracking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BookOpen className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>Peer Review</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Structured peer review workflows with transparent feedback and revision tracking.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <MessageSquare className="h-12 w-12 text-orange-600 mb-4" />
              <CardTitle>Discussion Forums</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Rich discussions with threading, annotations, and linking to specific content elements.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 bg-blue-50 rounded-lg my-8">
        <h3 className="text-3xl font-bold text-center mb-8">Core Principles</h3>
        <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">$0</div>
            <div className="text-lg font-semibold mb-2">Cost-Free</div>
            <p className="text-gray-600">Built on free hosting and database tiers</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">FAIR</div>
            <div className="text-lg font-semibold mb-2">Scientific Rigor</div>
            <p className="text-gray-600">DOI verification, evidence linking, peer review</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">AI+</div>
            <div className="text-lg font-semibold mb-2">Human-Governed</div>
            <p className="text-gray-600">AI assists, humans decide</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">🎨</div>
            <div className="text-lg font-semibold mb-2">White-Label</div>
            <p className="text-gray-600">Customizable for any working group</p>
          </div>
        </div>
      </section>

      <footer className="border-t mt-20 py-8 bg-gray-50">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2024 OpenLPM. All rights reserved.</p>
          <p className="mt-2 text-sm">Built with Next.js, Supabase, and shadcn/ui • Open Source & Customizable</p>
        </div>
      </footer>
    </div>
  )
}