import { RepositoryList } from "@/components/repository/repository-list";

export const dynamic = "force-dynamic";

export default function AllRepositoriesPage() {
  return <RepositoryList visibility={undefined} title="All repositories" />;
}
