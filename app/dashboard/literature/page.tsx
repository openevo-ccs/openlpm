'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search } from 'lucide-react'

export default function LiteraturePage() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Literature Management</h1>
        <p className="text-gray-600 mt-2">Search, verify, and manage scientific literature</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Literature</CardTitle>
          <CardDescription>
            Search OpenAlex for scientific papers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search for papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}