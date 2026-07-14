import { useEffect } from 'react'

/**
 * A tiny window-event bus so pages can tell the sidebar about mutations
 * without a shared data store: the page that creates or deletes something
 * emits, the sidebar listens and refetches just what changed.
 */
export const EV_PROJECT_CREATED = 'uc:project-created'
export const EV_PROJECT_DELETED = 'uc:project-deleted'
export const EV_QUESTION_CREATED = 'uc:question-created'
export const EV_QUESTION_DELETED = 'uc:question-deleted'
export const EV_PROJECT_VIEWED = 'uc:project-viewed'

export interface ProjectEventDetail {
  readonly projectId: string
}

export function emitProjectCreated(): void {
  window.dispatchEvent(new CustomEvent(EV_PROJECT_CREATED))
}

export function emitProjectDeleted(projectId: string): void {
  window.dispatchEvent(
    new CustomEvent<ProjectEventDetail>(EV_PROJECT_DELETED, { detail: { projectId } }),
  )
}

export function emitQuestionCreated(projectId: string): void {
  window.dispatchEvent(
    new CustomEvent<ProjectEventDetail>(EV_QUESTION_CREATED, { detail: { projectId } }),
  )
}

export function emitQuestionDeleted(projectId: string): void {
  window.dispatchEvent(
    new CustomEvent<ProjectEventDetail>(EV_QUESTION_DELETED, { detail: { projectId } }),
  )
}

export function emitProjectViewed(projectId: string): void {
  window.dispatchEvent(
    new CustomEvent<ProjectEventDetail>(EV_PROJECT_VIEWED, { detail: { projectId } }),
  )
}

/** Subscribe to one of the events above for the lifetime of the component. */
export function useWindowEvent(
  name: string,
  handler: (detail: ProjectEventDetail | undefined) => void,
): void {
  useEffect(() => {
    const listen = (e: Event) =>
      handler((e as CustomEvent<ProjectEventDetail>).detail)
    window.addEventListener(name, listen)
    return () => window.removeEventListener(name, listen)
  }, [name, handler])
}
