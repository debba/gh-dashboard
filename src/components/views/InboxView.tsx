import type { GhRepo } from "../../types/github";
import type { InboxItem } from "../../utils/inbox";
import { TriageWorkspace } from "./TriageWorkspace";

interface InboxViewProps {
  items: InboxItem[];
  mailboxLabel: string;
  search: string;
  page: number;
  pageSize: number;
  reposByName: Map<string, GhRepo>;
  onRepoClick: (repo: GhRepo) => void;
  onMarkRead: (threadId: string) => void;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function InboxView({
  items,
  mailboxLabel,
  search,
  page,
  pageSize,
  reposByName,
  onRepoClick,
  onMarkRead,
  onRefresh,
  onPageChange,
  onPageSizeChange,
}: InboxViewProps) {
  return (
    <TriageWorkspace
      className="view-inbox"
      items={items}
      title={mailboxLabel}
      emptyTitle="No inbox items"
      emptyMessage="Try another mailbox or clear the search."
      reposByName={reposByName}
      onRepoClick={onRepoClick}
      searchPlaceholder="Search inbox"
      search={search}
      hideInternalSearch
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onMarkRead={onMarkRead}
      onRefresh={onRefresh}
    />
  );
}
