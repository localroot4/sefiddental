import type { CollectionBeforeOperationHook, CollectionSlug, PayloadRequest, Where } from 'payload';
import { invalid } from './errors';

export const PASSWORD_MIN_LENGTH = 12;

const faDigits = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d);

/** Returns the Persian error for a password that breaks the policy, or null. */
export function passwordProblem(password: string, email?: string): string | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) {
    return `رمز عبور باید دست‌کم ${faDigits(PASSWORD_MIN_LENGTH)} نویسه باشد.`;
  }
  const local = email?.split('@')[0]?.trim().toLowerCase();
  if (local && password.toLowerCase().includes(local)) {
    return 'رمز عبور نباید بخش اول ایمیل را داشته باشد.';
  }
  return null;
}

interface PasswordArgs {
  data?: { email?: unknown; password?: unknown; token?: unknown };
  id?: number | string;
  where?: Where;
}

/**
 * The emails the password is checked against: the incoming email, else the stored email of
 * every account the operation changes. A password-only update or a reset carries no email.
 * beforeOperation runs before Payload's access check, so the update lookups keep the caller's
 * read access: otherwise an anonymous PATCH would learn whether a guess is in someone's email.
 * A reset is found by its token, which only the account owner holds.
 */
async function emailsFor(
  operation: 'create' | 'resetPassword' | 'update',
  args: PasswordArgs,
  slug: CollectionSlug,
  req: PayloadRequest,
  overrideAccess: boolean,
): Promise<string[]> {
  if (typeof args.data?.email === 'string') return [args.data.email];
  let docs: unknown[] = [];
  if (operation === 'resetPassword' && typeof args.data?.token === 'string') {
    // The same lookup resetPassword itself runs; the token field is hidden from queries.
    docs = [
      await req.payload.db.findOne({
        collection: slug,
        req,
        where: { resetPasswordToken: { equals: args.data.token } },
      }),
    ];
  } else if (operation === 'update' && args.id !== undefined) {
    docs = [
      await req.payload.findByID({
        collection: slug,
        id: args.id,
        depth: 0,
        overrideAccess,
        disableErrors: true,
        req,
      }),
    ];
  } else if (operation === 'update' && args.where) {
    docs = (
      await req.payload.find({
        collection: slug,
        where: args.where,
        depth: 0,
        pagination: false,
        overrideAccess,
        req,
      })
    ).docs;
  }
  return docs.flatMap((doc) => {
    const email = (doc as { email?: unknown } | null)?.email;
    return typeof email === 'string' ? [email] : [];
  });
}

/**
 * Runs before create, update and resetPassword with the incoming password (beforeValidate of
 * resetPassword receives the stored user without it). registerFirstUser calls create.
 */
export const enforcePasswordPolicy: CollectionBeforeOperationHook = async ({
  args,
  collection,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update' && operation !== 'resetPassword') {
    return args;
  }
  const passwordArgs = args as PasswordArgs;
  const password = passwordArgs.data?.password;
  if (typeof password !== 'string') return args;
  const tooShort = passwordProblem(password);
  const emails = tooShort
    ? []
    : await emailsFor(operation, passwordArgs, collection.slug, req, overrideAccess ?? false);
  const message = tooShort ?? emails.map((email) => passwordProblem(password, email)).find(Boolean);
  if (message) {
    throw invalid(collection.slug, [{ message, path: 'password' }], req.t);
  }
  return args;
};
