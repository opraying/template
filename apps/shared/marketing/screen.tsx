import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { content } from '../content/landing'

export function Component() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-7xl flex flex-col gap-10">
      {/* Hero Section */}
      <div className="relative px-8 py-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {content.hero.title}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{content.hero.description}</p>
      </div>

      {/* Development Features */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-blue-500/10 px-3 py-4">
            <CardTitle className="text-lg flex items-center gap-1.5">
              <i className="i-lucide-code h-5 w-5" />
              End-to-End Type Safety
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <TechDetail title="Effect Runtime" description="Functional programming with powerful type inference" />
            <TechDetail title="API Generation" description="Automatic type-safe API from schemas" />
            <TechDetail title="Development Tools" description="Advanced debugging with Effect DevTools" />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-violet-500/10 px-3 py-4">
            <CardTitle className="text-lg flex items-center gap-1.5">
              <i className="i-lucide-settings h-5 w-5" />
              Developer Experience
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <TechDetail title="Vite + HMR" description="Lightning-fast hot module replacement" />
            <TechDetail title="React router SSR" description="Server-side rendering with nested routing" />
            <TechDetail title="OpenTelemetry" description="Built-in monitoring and tracing" />
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-cyan-500/10 px-3 py-4">
            <CardTitle className="text-lg flex items-center gap-1.5">
              <i className="i-lucide-cloud h-5 w-5" />
              Cloud Native
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <TechDetail title="Edge Computing" description="Deploy globally with Cloudflare Workers" />
            <TechDetail title="Static Export" description="Generate static sites with PWA support" />
            <TechDetail title="Docker Ready" description="Containerized deployment with CI/CD" />
          </CardContent>
        </Card>
      </div>

      {/* Example Applications */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Example Applications</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explore real-world examples showcasing the capabilities of our stack
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {content.technical.examples.items.map((example) => (
            <Card key={example.title} className="group overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-secondary/5 py-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <i className={getExampleIcon(example.title)} />
                  {example.title}
                </CardTitle>
                <CardDescription className="text-sm">{example.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="text-sm space-y-1">
                  {getExampleFeatures(example.title).map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <i className="i-lucide-check h-3.5 w-3.5 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function TechDetail({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-primary mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function getExampleIcon(title: string): string {
  const icons: Record<string, string> = {
    'Offline Notes': 'i-lucide-file-text h-5 w-5 text-primary',
    'Task Manager': 'i-lucide-check-square h-5 w-5 text-primary',
    'Document Editor': 'i-lucide-edit h-5 w-5 text-primary',
  }
  return icons[title] || 'i-lucide-app-window h-5 w-5 text-primary'
}

function getExampleFeatures(title: string): string[] {
  const features: Record<string, string[]> = {
    'Offline Notes': [
      'Real-time collaboration',
      'Offline editing',
      'Automatic conflict resolution',
      'End-to-end encryption',
    ],
    'Task Manager': ['Multi-device sync', 'Real-time updates', 'Offline capability', 'Team sharing'],
    'Document Editor': ['Collaborative editing', 'Version history', 'Rich text support', 'Auto-save'],
  }
  return features[title] || []
}
