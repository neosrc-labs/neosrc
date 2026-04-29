interface RightSidebarProps {
  pullRequest: {
    labels?: Array<{ name: string; color: string }>;
    requested_reviewers?: Array<{ login: string }>;
    assignees?: Array<{ login: string }>;
    milestone?: { title: string } | null;
  };
}

export default function RightSidebar({ pullRequest }: RightSidebarProps) {
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
                <li
                  key={reviewer.login}
                  className="text-sm text-gray-600"
                >
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
    </aside>
  );
}
