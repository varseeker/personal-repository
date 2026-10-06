import { RepositoryList } from "@/components/repository/repository-list";

export const dynamic = "force-dynamic";

export default function PrivateMinePage() {
  return <RepositoryList visibility="private" title="My private repositories" />;
}
