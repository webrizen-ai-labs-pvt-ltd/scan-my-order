import { AnimatedThemeToggler } from '@smo/ui'

function App() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <AnimatedThemeToggler />
      </div>
      <h1 className="text-4xl font-elsie text-primary mb-4">SMO - Marketing</h1>
      <p className="text-muted-foreground">The best restaurant management system.</p>
    </div>
  )
}

export default App
