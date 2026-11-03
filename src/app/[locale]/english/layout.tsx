import { RequireAuth } from '@/src/components/auth/RequireAuth'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
