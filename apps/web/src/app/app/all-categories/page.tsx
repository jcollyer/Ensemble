import { AllCardsView } from '@/features/categories/AllCardsView';

/**
 * Aggregate "All decks" view. Lives at its own top-level path rather than
 * under /app/categories so the [id] segment is unambiguously a single deck.
 */
export default function AllCategoriesPage() {
  return <AllCardsView />;
}
