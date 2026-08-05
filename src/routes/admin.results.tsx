import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/results')({
  component: () => <div className="p-8 text-center text-muted-foreground">Admin Results (Coming Soon)</div>
})
