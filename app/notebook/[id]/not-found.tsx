import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'

export default function NotebookNotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-sm border border-dashed">
        <EmptyHeader>
          <EmptyTitle>
            <h1>Notizbuch nicht gefunden</h1>
          </EmptyTitle>
          <EmptyDescription>
            Dieses Notizbuch existiert nicht, wurde entfernt oder gehört zu
            einem anderen Konto.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          render={<Link href="/" />}
          nativeButton={false}
          variant="outline"
          className="mx-auto"
        >
          <ArrowLeft data-icon="inline-start" />
          Zur Übersicht
        </Button>
      </Empty>
    </div>
  )
}
