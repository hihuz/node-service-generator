import { Context, Next } from "koa";

// Dummy error handler middleware
export function errorHandler() {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err) {
      ctx.status = err.code;
      ctx.body = {
        code: err.code,
        error: err.error,
        message: err.message,
      };
    }
  };
}
