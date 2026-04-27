import { AllCardsView } from '@/features/categories/AllCardsView';

/**
 * Aggregate "All decks" view. The static /all path takes precedence over the
 * dynamic [id] segment in Next.js's App Router, so we don't need to special
 * case the id="all" string in the deck detail page.
 */
export default function AllCategoriesPage() {
  return <AllCardsView />;
}
