import { useContext, useEffect } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

export function LeaveConfirmation({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  return <AlertDialog open={open}>
    <AlertDialogContent onEscapeKeyDown={event => { event.preventDefault(); onStay(); }}>
      <AlertDialogHeader><AlertDialogTitle>還有尚未儲存的內容</AlertDialogTitle>
        <AlertDialogDescription>離開會放棄這次尚未儲存的修改。</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel onClick={onStay}>繼續編輯</AlertDialogCancel>
        <AlertDialogAction onClick={onLeave}>放棄修改並離開</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function RouteGuard({ dirty, onDiscard }: { dirty: boolean; onDiscard?:()=>void }) {
  const blocker = useBlocker(dirty);
  return <LeaveConfirmation open={blocker.state === 'blocked'}
    onStay={() => { if (blocker.state === 'blocked') blocker.reset(); }}
    onLeave={() => { if (blocker.state === 'blocked') { onDiscard?.(); blocker.proceed(); } }} />;
}

export function UnsavedChangesGuard({ dirty, onDiscard }: { dirty: boolean; onDiscard?:()=>void }) {
  const router = useContext(UNSAFE_DataRouterContext);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  // Standalone previews can use MemoryRouter; production uses the data router.
  return router && dirty ? <RouteGuard dirty={dirty} onDiscard={onDiscard} /> : null;
}
