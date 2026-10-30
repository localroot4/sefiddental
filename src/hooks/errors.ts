import { ValidationError, type AfterErrorHook } from 'payload';

type Thrown = Error & { isPublic?: boolean; data?: Record<string, unknown> };

/**
 * Payload's REST answer keeps a ValidationError's field messages only when `instanceof` matches,
 * and the production build carries one copy of Payload per route bundle. An error thrown by a hook
 * of the copy that started Payload (often the admin page's) reaches the API route's formatter as a
 * foreign class and loses `data.errors`: the editor saw «The following field is invalid» with no
 * reason. Puts the public data back, in Payload's own shape.
 */
export const keepValidationDetails: AfterErrorHook = ({ error, result }) => {
  const thrown = error as Thrown;
  if (thrown.name !== 'ValidationError' || thrown.isPublic !== true || !thrown.data) return;
  if (!result || result.errors[0]?.data) return;
  return {
    response: { errors: [{ name: thrown.name, data: thrown.data, message: thrown.message }] },
  };
};

type FieldError = { path: string; message: string };

/**
 * A ValidationError whose own message, the one the admin shows in its toast, reads in the admin's
 * language: Payload's prefix through `t` (req.t) and each field's Persian message as its label.
 * Without them the toast said «The following field is invalid: status».
 */
export function invalid(
  collection: string,
  errors: FieldError[],
  t?: ConstructorParameters<typeof ValidationError>[1],
): ValidationError {
  return new ValidationError(
    { collection, errors: errors.map((error) => ({ ...error, label: error.message })) },
    t,
  );
}
