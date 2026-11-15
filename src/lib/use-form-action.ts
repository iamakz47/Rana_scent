"use client";

import { startTransition, useActionState, type FormEvent } from "react";

// useActionState for forms that must KEEP what the visitor typed when the
// server answers with an error. React resets uncontrolled fields after a
// <form action> submission; submitting from onSubmit inside a transition
// avoids that reset. The returned `action` still goes on the form so it
// works before hydration (progressive enhancement).
export function useFormAction<S>(fn: (state: Awaited<S>, formData: FormData) => S | Promise<S>, initial: Awaited<S>) {
  const [state, action, pending] = useActionState(fn, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>, beforeSubmit?: () => boolean) => {
    event.preventDefault();
    if (beforeSubmit && !beforeSubmit()) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
  return [state, action, pending, onSubmit] as const;
}
