import Router from "koa-router";
import { CrudController } from "../controller/crud.controller";

export class AppRouter extends Router {
  public addControllerRoutes<T>(controller: CrudController<T>): void {
    controller.addRoutes(this);
  }
}
