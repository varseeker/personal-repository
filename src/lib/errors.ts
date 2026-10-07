export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

type ErrorLike = {
  message?: string;
  code?: string;
};

export function isNextRedirect(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "digest" in error
    && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

export function logServerError(scope: string, error: unknown): void {
  const details = error as ErrorLike;
  const code = details?.code ? ` ${details.code}` : "";
  const message = error instanceof Error ? error.message : details?.message ?? "Unknown error";
  console.error(`[${scope}]${code} ${message}`);
}

export function friendlyError(error: unknown): string {
  if (error instanceof AppError) return error.message;

  const details = error as ErrorLike;
  const message = `${details?.code ?? ""} ${details?.message ?? ""}`.toLowerCase();

  if (message.includes("storage_quota_exceeded")) return "Not enough storage space.";
  if (message.includes("repository_quota_exceeded")) {
    return "This repository has reached its storage limit.";
  }
  if (message.includes("invalid_username")) {
    return "Usernames must be 3–32 characters and use lowercase letters, numbers, or hyphens.";
  }
  if (message.includes("invalid_name")) return "That name is not allowed.";
  if (message.includes("folder_cycle")) return "A folder cannot be moved into itself.";
  if (message.includes("invalid_parent_folder")) return "That folder is not available.";
  if (message.includes("storage_object_missing")) return "The upload did not finish. Please try again.";
  if (message.includes("invalid_storage_path")) return "Unable to store that file.";
  if (message.includes("forbidden")) return "You do not have permission to do that.";
  if (message.includes("23505") || message.includes("duplicate key")) {
    return "An item with that name already exists.";
  }
  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with that email already exists.";
  }
  if (message.includes("email not confirmed")) {
    return "The account was created, but sign-in is still waiting on email confirmation.";
  }
  if (message.includes("password")) return "Choose a password of at least 8 characters.";
  if (message.includes("rate")) return "Too many attempts. Please wait and try again.";

  return "Something went wrong. Please try again.";
}
