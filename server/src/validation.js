import { z } from 'zod'

// ============================================================================
// Validation Schemas for Bench-Street API
// ============================================================================

// User validation schemas
export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only use letters, numbers, underscore and hyphen')

export const emailSchema = z.string()
  .max(254, 'Email is too long')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address')
  .nullable()

export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(200, 'Password is too long')

// Signup schema
export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema
})

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(20),
  password: z.string().min(1, 'Password is required').max(200)
})

// Model validation schemas
export const modelSlugSchema = z.string()
  .min(1, 'Model slug is required')
  .max(100, 'Model slug is too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid model slug format')

// Vote value schema (must be 1 or -1)
export const voteValueSchema = z.number()
  .int('Vote value must be an integer')
  .refine((val) => val === 1 || val === -1, {
    message: 'Value must be 1 (like) or -1 (dislike)'
  })

// Vote schema
export const voteSchema = z.object({
  value: voteValueSchema
})

// Comment schema
export const commentSchema = z.object({
  body: z.string()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment too long (max 500 characters)')
})

// Trade schema
export const tradeSchema = z.object({
  side: z.enum(['buy', 'sell'], 'Side must be either "buy" or "sell"'),
  shares: z.number()
    .positive('Shares must be a positive number')
    .max(1000000, 'Shares amount is too large')
})

// Market position schema
export const marketPositionSchema = z.object({
  outcomeId: z.number()
    .int('Outcome ID must be an integer')
    .positive('Outcome ID must be positive'),
  stake: z.number()
    .positive('Stake must be a positive number')
    .max(1000000, 'Stake amount is too large')
})

// Battle bet schema
export const battleBetSchema = z.object({
  sideModelId: z.number()
    .int('Model ID must be an integer')
    .positive('Model ID must be positive'),
  stake: z.number()
    .positive('Stake must be a positive number')
    .max(1000000, 'Stake amount is too large')
})

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
})

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Create validation middleware for request body
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {Function} Express middleware
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors
        })
      }
      return res.status(400).json({ error: 'Invalid request data' })
    }
  }
}

/**
 * Create validation middleware for request params
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {Function} Express middleware
 */
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.validatedParams = schema.parse(req.params)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors
        })
      }
      return res.status(400).json({ error: 'Invalid request parameters' })
    }
  }
}

/**
 * Create validation middleware for query params
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {Function} Express middleware
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.validatedQuery = schema.parse(req.query)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors
        })
      }
      return res.status(400).json({ error: 'Invalid query parameters' })
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate and parse a value against a schema
 * @param {any} value - Value to validate
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {any} Parsed value
 * @throws {z.ZodError} If validation fails
 */
export function validate(value, schema) {
  return schema.parse(value)
}

/**
 * Validate and parse a value, returning null on failure
 * @param {any} value - Value to validate
 * @param {z.ZodSchema} schema - Zod validation schema
 * @returns {any|null} Parsed value or null
 */
export function validateSafe(value, schema) {
  try {
    return schema.parse(value)
  } catch {
    return null
  }
}

export default {
  // Schemas
  usernameSchema,
  emailSchema,
  passwordSchema,
  signupSchema,
  loginSchema,
  modelSlugSchema,
  voteValueSchema,
  voteSchema,
  commentSchema,
  tradeSchema,
  marketPositionSchema,
  battleBetSchema,
  paginationSchema,
  
  // Middleware
  validateBody,
  validateParams,
  validateQuery,
  
  // Helpers
  validate,
  validateSafe
}
