import React from "react"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui"

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-8 gap-8 font-sans">
      <div className="flex items-center gap-3">
        <Badge variant="default" className="text-sm px-3 py-1 bg-indigo-600 text-white">
          @repo/ui
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Scan My Order - Shared UI Components</h1>
      </div>

      <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-white">Shadcn UI Demonstration</CardTitle>
          <CardDescription className="text-slate-400">
            Powered by pure JavaScript (@repo/ui) inside Turborepo monorepo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full bg-slate-800 text-slate-400">
              <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
              <TabsTrigger value="inputs" className="flex-1">Inputs</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4 space-y-2 text-sm text-slate-300">
              <p>All official base Shadcn UI components are installed in <code>packages/ui</code> as <code>@repo/ui</code>.</p>
              <div className="flex gap-2 pt-2">
                <Badge variant="outline" className="border-slate-700 text-slate-300">Pure JSX</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">Tailwind v4</Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-300">Radix UI</Badge>
              </div>
            </TabsContent>
            <TabsContent value="inputs" className="pt-4 space-y-3">
              <Input
                placeholder="Enter customer email..."
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
              />
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Submit
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">
            Cancel
          </Button>
          <Button variant="default" className="bg-white text-slate-950 hover:bg-slate-200">
            Get Started
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
