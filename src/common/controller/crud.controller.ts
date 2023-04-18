import * as Router from "koa-router";
import * as _ from "lodash";

import {
  ICreateItemDataProvider,
  IDeleteItemDataProvider,
  IGetItemDataProvider,
  IGetListDataProvider,
  IUpdateItemDataProvider,
  PartialDataProvider,
  TypeGuard,
} from "../dataprovider/dataprovider.interface";

import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ContextRequest } from "../context/context-request.class";

export abstract class CrudController<T extends Record<string, any>> {
  /** The API route segment (e.g. "api/campaign") */
  protected abstract routeSegment: string;

  /** Name of swagger schema definition for this entity. Used to adjust output. */
  protected entitySchema: string;

  /** Name of the privilege that is needed to run requests against the endpoints. */
  protected privilege: string | string[] = null;
  protected needsSuperPrivileges = false;

  /** api + endpoint rbac permission privileges that are needed to run requests against the endpoints */
  protected needsRbacPermission: { api: string; endpoint: string } = null;

  /** List of paths which will be limited to {id, name}, respective [{id, name}, ...] in output */
  protected relationsTraitProperties: string[] = [];

  /** List of paths which will be removed from output if empty. */
  protected optionalProperties: string[] = [];

  /** Data provider which is set in the unit tests */
  private dataProvider: PartialDataProvider<T>;

  /**
   * @inheritDoc
   */
  public addRoutes(router: Router): void {
    this.addCreateRoute(router);
    this.addRetrieveRoutes(router);
    this.addUpdateRoutes(router);
    this.addDeleteRoute(router);
  }

  /**
   * Decide which data provider should be used to handle the incoming request.
   */
  public getDataProvider(): PartialDataProvider<T> {
    if (this.dataProvider) {
      return this.dataProvider;
    }

    return this.createDataProvider();
  }

  /**
   * Decide which data provider should be used to handle the incoming request.
   */
  public setDataProvider(dataProvider: PartialDataProvider<T>): void {
    this.dataProvider = dataProvider;
  }

  /**
   * Decide which data provider should be used to handle the incoming request.
   */
  protected abstract createDataProvider(): PartialDataProvider<T>;

  /**
   * Create the default POST route to create an entity.
   *
   * @param router
   */
  protected addCreateRoute(router: Router): void {
    const base = "/" + this.routeSegment;

    router.post("post", base, async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isCreateItemDataProvider<T>(dataProvider)) {
        ctx.body = await this.createItem(dataProvider, ctx);
      }
    });
  }

  /**
   * Create the default GET routes to get one or many entities.
   *
   * @param router
   */
  protected addRetrieveRoutes(router: Router): void {
    const base = "/" + this.routeSegment;

    router.get("get", base, async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isGetListDataProvider<T>(dataProvider)) {
        ctx.body = await this.getList(dataProvider, ctx);
      }
    });

    router.get("getOne", base + "/:id(\\d+)", async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isGetItemDataProvider<T>(dataProvider)) {
        ctx.body = await this.getItem(dataProvider, ctx);
      }
    });
  }

  /**
   * Create the default PUT and PATCH routes to update an entity.
   *
   * @param router
   */
  protected addUpdateRoutes(router: Router): void {
    const base = "/" + this.routeSegment;

    router.put("put", base + "/:id(\\d+)", async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isUpdateItemDataProvider<T>(dataProvider)) {
        ctx.body = await this.updateItem(dataProvider, ctx, false);
      }
    });

    router.patch("patch", base + "/:id(\\d+)", async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isUpdateItemDataProvider<T>(dataProvider)) {
        ctx.body = await this.updateItem(dataProvider, ctx, true);
      }
    });
  }

  /**
   * Create the DELETE route to delete an entity.
   *
   * @param router
   */
  protected addDeleteRoute(router: Router): void {
    const base = "/" + this.routeSegment;

    router.delete("delete", base + "/:id(\\d+)", async (ctx) => {
      const dataProvider = this.getDataProvider();

      if (TypeGuard.isDeleteItemDataProvider(dataProvider)) {
        ctx.body = await this.deleteItem(dataProvider, ctx);
      }
    });
  }

  /**
   * Extend this method to adjust input (e.g. if we do not want to support deprecated properties)
   *
   * @param entity
   */
  protected async transformInput(
    entity: Partial<T>,
    _state: AuthContextMetadata
  ): Promise<any> {
    return entity;
  }

  /**
   * Return a list of model entities.
   *
   * @param dataProvider
   * @param ctx
   * @returns {Promise<{}>}
   */
  protected async getList(
    dataProvider: IGetListDataProvider<T>,
    ctx: Router.IRouterContext
  ): Promise<{
    data: T[];
    count: number;
  }> {
    const state: AuthContextMetadata = ctx.state.auth;
    const request: ContextRequest = new ContextRequest(ctx.request.query);

    const [entities, count] = await dataProvider.getList(state, request);

    return { data: entities, count };
  }

  /**
   * Return a single model entity.
   *
   * @param dataProvider
   * @param ctx
   * @returns {Promise<{}>}
   */
  protected async getItem(
    dataProvider: IGetItemDataProvider<T>,
    ctx: Router.IRouterContext
  ): Promise<T> {
    const state: AuthContextMetadata = ctx.state.auth;
    const id: number = parseInt(ctx.params.id, 10);

    const entity = await dataProvider.getItem(state, id);

    return entity;
  }

  /**
   * Create a single model entity.
   *
   * @param dataProvider
   * @param ctx
   * @returns {Promise<{}>}
   */
  protected async createItem(
    dataProvider: ICreateItemDataProvider<T>,
    ctx: Router.IRouterContext
  ): Promise<T> {
    const state: AuthContextMetadata = ctx.state.auth;
    const body: T = await this.transformInput(
      _.get(ctx, "request.body", {}),
      state
    );

    if (ctx.response) {
      ctx.response.status = 201;
    }

    const entity = await dataProvider.createItem(state, body);

    return entity;
  }

  /**
   * Update a single model entity.
   *
   * @param dataProvider
   * @param ctx
   * @param isPartial
   * @returns {Promise<{}>}
   */
  protected async updateItem(
    dataProvider: IUpdateItemDataProvider<T>,
    ctx: Router.IRouterContext,
    isPartial: boolean
  ): Promise<T> {
    const state: AuthContextMetadata = ctx.state.auth;
    const id: number = parseInt(ctx.params.id, 10);
    const body: T = await this.transformInput(
      _.get(ctx, "request.body", {}),
      state
    );

    const entity = await dataProvider.updateItem(state, id, body, isPartial);

    return entity;
  }

  /**
   * Delete a single model entity.
   *
   * @param dataProvider
   * @param ctx
   * @returns {Promise<{}>}
   */
  protected async deleteItem(
    dataProvider: IDeleteItemDataProvider<T>,
    ctx: Router.IRouterContext
  ): Promise<Partial<T>> {
    const state: AuthContextMetadata = ctx.state.auth;
    const id: number = parseInt(ctx.params.id, 10);

    const entity = await dataProvider.deleteItem(state, id);

    return entity;
  }
}
