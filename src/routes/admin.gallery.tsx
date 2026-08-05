import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/gallery')({
  component: () => <div className="p-8 text-center text-muted-foreground">Admin Gallery (Coming Soon)</div>
})
