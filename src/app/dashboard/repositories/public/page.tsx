import { RepositoryList } from "@/components/repository/repository-list";

export const dynamic = "force-dynamic";

export default function PublicMinePage() {
  return <RepositoryList visibility="public" title="My public repositories" />;
}
