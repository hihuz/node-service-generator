import { Context, Next } from "koa";
import { AuthContextMetadata } from "../../common/context/auth-context-metadata.class";

// Dummy auth middleware attaching state.auth to context
export function authenticate() {
  return async (ctx: Context, next: Next) => {
    ctx.state.auth = new AuthContextMetadata({
      market_place: [17, 20],
      reader: true,
    });

    await next();
  };
}
