import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/faculty')({
  component: () => <div className="p-8 text-center text-muted-foreground">Admin Faculty (Coming Soon)</div>
})
