import { notFound } from "next/navigation";

// Unknown paths under a locale render the store's branded 404 inside the
// store layout instead of the bare framework page.
export default function MissingPage() {
  notFound();
}
