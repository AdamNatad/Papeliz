// Reads what went wrong from whatever Clerk returned: an API reply's first error, a ClerkError, or
// any other Error.

export interface PapelizAccountClerkErrorReading {
  clerkErrorCode: string | null
  clerkErrorMessage: string
}

export const papelizAccountClerkFallbackErrorMessage = 'Something went wrong. Please try again.'

export function readPapelizAccountClerkError(clerkErrorCandidate: unknown): PapelizAccountClerkErrorReading {
  if (typeof clerkErrorCandidate !== 'object' || clerkErrorCandidate === null) {
    return { clerkErrorCode: null, clerkErrorMessage: papelizAccountClerkFallbackErrorMessage }
  }
  const clerkErrorRecord = clerkErrorCandidate as { errors?: unknown; code?: unknown; longMessage?: unknown; message?: unknown }
  const firstClerkApiError =
    Array.isArray(clerkErrorRecord.errors) && typeof clerkErrorRecord.errors[0] === 'object' && clerkErrorRecord.errors[0] !== null
      ? (clerkErrorRecord.errors[0] as { code?: unknown; longMessage?: unknown; message?: unknown })
      : null
  const clerkErrorSource = firstClerkApiError ?? clerkErrorRecord
  const clerkErrorCode = typeof clerkErrorSource.code === 'string' ? clerkErrorSource.code : null
  const clerkErrorMessage =
    typeof clerkErrorSource.longMessage === 'string' && clerkErrorSource.longMessage
      ? clerkErrorSource.longMessage
      : typeof clerkErrorSource.message === 'string' && clerkErrorSource.message
        ? clerkErrorSource.message
        : papelizAccountClerkFallbackErrorMessage
  return { clerkErrorCode, clerkErrorMessage }
}

// Clerk's own error codes this page answers in its own words.
export const papelizAccountClerkErrorCodes = {
  identifierNotFound: 'form_identifier_not_found',
  identifierAlreadyUsed: 'form_identifier_exists',
  codeIncorrect: 'form_code_incorrect',
  codeExpired: 'verification_expired',
  sessionExists: 'session_exists',
  // Deleting the account asked for a more recent sign-in.
  reverificationRequired: 'session_reverification_required',
} as const
