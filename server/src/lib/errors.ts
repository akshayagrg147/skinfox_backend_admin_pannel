export class ApiError extends Error {
  statusCode: number
  code: string
  fieldErrors?: Record<string, string>
  constructor(statusCode: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const validationError = (message: string, fieldErrors?: Record<string, string>) => new ApiError(400, 'VALIDATION_ERROR', message, fieldErrors)
export const notFound = (message = 'Resource not found') => new ApiError(404, 'NOT_FOUND', message)
export const forbidden = (message = 'You do not have permission for this action') => new ApiError(403, 'FORBIDDEN', message)
