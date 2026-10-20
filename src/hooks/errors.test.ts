import { ValidationError } from 'payload';
import { describe, expect, it } from 'vitest';

import { keepValidationDetails } from './errors';

const args = (
  error: Error,
  result: { errors: { data?: Record<string, unknown>; message?: string }[] },
) => ({ error, result, req: {}, context: {} }) as never;

/** A ValidationError from another copy of Payload: same name and fields, another class. */
function foreign(): Error {
  const own = new ValidationError({ errors: [{ path: 'status', message: 'یادداشت بنویسید.' }] });
  return Object.assign(new Error(own.message), {
    name: own.name,
    isPublic: own.isPublic,
    data: own.data,
  });
}

describe('keepValidationDetails', () => {
  it('ER1 a foreign ValidationError gets its field messages back', () => {
    const error = foreign();
    expect(keepValidationDetails(args(error, { errors: [{ message: error.message }] }))).toEqual({
      response: {
        errors: [
          {
            name: 'ValidationError',
            data: { errors: [{ path: 'status', message: 'یادداشت بنویسید.' }] },
            message: error.message,
          },
        ],
      },
    });
  });

  it('ER2 leaves a formatted answer, a private error and other errors alone', () => {
    const error = foreign();
    expect(
      keepValidationDetails(args(error, { errors: [{ data: { errors: [] }, message: 'x' }] })),
    ).toBeUndefined();
    const hidden = Object.assign(foreign(), { isPublic: false });
    expect(keepValidationDetails(args(hidden, { errors: [{ message: 'x' }] }))).toBeUndefined();
    expect(
      keepValidationDetails(args(new Error('boom'), { errors: [{ message: 'x' }] })),
    ).toBeUndefined();
  });
});
