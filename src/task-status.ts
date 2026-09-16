const BADGE_LABELS: Record<string, string> = {
  not_approved: 'Not approved',
  needs_review: 'Needs review',
  awaiting_approval: 'Awaiting approval',
  changes_requested: 'Changes requested',
  approved: 'Approved',
}

// Used only when a server predates `approval_badge` but sends `approval`.
const SUBMISSION_STATE_LABELS: Record<string, string> = {
  not_approved: 'Not approved',
  pending: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
}

/**
 * Human status for a task completion row. Approval state is consulted before
 * `completed_at`, because a not-approved submission also sets `completed_at`
 * and would otherwise read as complete.
 */
export function taskCompletionStatus(row: Record<string, unknown>): string {
  const badge = row.approval_badge
  if (typeof badge === 'string' && BADGE_LABELS[badge]) return BADGE_LABELS[badge]

  if (badge === undefined) {
    const approval = row.approval as { latest_submission_state?: string | null } | undefined
    const state = approval?.latest_submission_state
    if (state === 'not_approved') return SUBMISSION_STATE_LABELS[state]
    if (state && !row.completed_at && SUBMISSION_STATE_LABELS[state]) return SUBMISSION_STATE_LABELS[state]
  }

  const taskType = row.task_type ?? (row.task as { type?: string } | undefined)?.type
  if (taskType === 'Resource') return 'Resource'
  if (row.completed_at) return 'Complete'
  if (row.overdue === true) return 'Overdue'
  return 'Open'
}

/** Copy of a list response with a derived `status` column on every row. */
export function withTaskCompletionStatus<T extends { collection: Record<string, unknown>[] }>(response: T): T {
  return {
    ...response,
    collection: response.collection.map((row) => ({ ...row, status: taskCompletionStatus(row) })),
  }
}
