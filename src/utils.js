import { pipe, when, clamp } from 'ramda'

/**
 * Safely parse an integer, returning null for invalid values instead of NaN
 * @param {string} input - String to parse
 * @returns {number | null} Parsed integer or null if invalid
 */
export const safeParseInt = (input) => {
    const parsed = parseInt(input, 10)
    return Number.isNaN(parsed) ? null : parsed
}

/**
 * Parse integer with optional min/max constraints using functional composition
 * @param {number} [min] - Minimum value constraint
 * @param {number} [max] - Maximum value constraint  
 * @returns {function(string): number | null} Function that parses and constrains integers
 */
export const parseIntWithBounds = (min, max) => pipe(
    safeParseInt,
    when(
        (value) => value !== null,
        (value) => {
            if (min !== undefined && max !== undefined) {
                return clamp(min, max, value)
            }
            if (min !== undefined) {
                return Math.max(value, min)
            }
            if (max !== undefined) {
                return Math.min(value, max)
            }
            return value
        }
    )
)

