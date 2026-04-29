interface RightSidebarProps {
  pullRequest: {
    labels?: Array<{ name: string; color: string }>;
    requested_reviewers?: Array<{ login: string }>;
    assignees?: Array<{ login: string }>;
    milestone?: { title: string } | null;
  };
  commits: Array<{
    sha: string;
    commit: { message: string; committer: { date: string } };
    author: { login: string; avatar_url: string } | null;
  }>;
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function RightSidebar({
  pullRequest,
  commits,
}: RightSidebarProps) {
  return (
    <aside className="border-l border-gray-200 bg-white px-4 py-6">
      <div className="space-y-6">
        {/* Labels Section */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Labels</h3>
          {pullRequest.labels && pullRequest.labels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pullRequest.labels.map((label) => (
                <span
                  key={label.name}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `#${label.color}20`,
                    color: `#${label.color}`,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No labels</p>
          )}
        </section>

        {/* Reviewers Section */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Reviewers
          </h3>
          {pullRequest.requested_reviewers &&
          pullRequest.requested_reviewers.length > 0 ? (
            <ul className="space-y-1">
              {pullRequest.requested_reviewers.map((reviewer) => (
                <li key={reviewer.login} className="text-sm text-gray-600">
                  {reviewer.login}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No reviewers</p>
          )}
        </section>

        {/* Assignees Section */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Assignees
          </h3>
          {pullRequest.assignees && pullRequest.assignees.length > 0 ? (
            <ul className="space-y-1">
              {pullRequest.assignees.map((assignee) => (
                <li key={assignee.login} className="text-sm text-gray-600">
                  {assignee.login}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No assignees</p>
          )}
        </section>

        {/* Milestone Section */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Milestone
          </h3>
          {pullRequest.milestone ? (
            <p className="text-sm text-gray-600">
              {pullRequest.milestone.title}
            </p>
          ) : (
            <p className="text-sm text-gray-500">No milestone</p>
          )}
        </section>
      </div>

      {/* Commits Section */}
      <div className="mt-6 border-t border-gray-200 pt-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Commits</h3>
        {commits.length > 0 ? (
          <div className="space-y-4">
            {commits.map((commit) => (
              <div key={commit.sha} className="flex items-start gap-3">
                {commit.author && (
                  <img
                    src={commit.author.avatar_url}
                    alt={commit.author.login}
                    className="mt-0.5 h-6 w-6 rounded-full"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {commit.commit.message.split("\n")[0]}
                  </p>
                  {commit.author && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {commit.author.login} committed{" "}
                      {formatRelativeTime(commit.commit.committer.date)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No commits</p>
        )}
      </div>
    </aside>
  );
}
