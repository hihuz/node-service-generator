import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ContextRequest } from "../context/context-request.class";

// note: this is a union type containing only LCM set methods which is different to Partial<IDataProvider<T>>
export type PartialDataProvider<T> =
  | IGetListDataProvider<T>
  | IGetItemDataProvider<T>
  | ICreateItemDataProvider<T>
  | IUpdateItemDataProvider<T>
  | IDeleteItemDataProvider<T>
  | IValidateDataProvider<T>;

// Type inference helper for duck typing the implemented interface types.
export class TypeGuard {
  public static isGetListDataProvider<T>(
    provider: any
  ): provider is IGetListDataProvider<T> {
    return !!provider.getList;
  }

  public static isGetItemDataProvider<T>(
    provider: any
  ): provider is IGetItemDataProvider<T> {
    return !!provider.getItem;
  }

  public static isCreateItemDataProvider<T>(
    provider: any
  ): provider is ICreateItemDataProvider<T> {
    return !!provider.createItem;
  }

  public static isUpdateItemDataProvider<T>(
    provider: any
  ): provider is IUpdateItemDataProvider<T> {
    return !!provider.updateItem;
  }

  public static isDeleteItemDataProvider<T>(
    provider: any
  ): provider is IDeleteItemDataProvider<T> {
    return !!provider.deleteItem;
  }

  public static isValidateDataProvider<T>(
    provider: any
  ): provider is IValidateDataProvider<T> {
    return !!provider.validate;
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IDynamicDataProvider {}

export interface IGetListDataProvider<T> {
  /**
   * Return an array of entities T (as a promise).
   *
   * @param state
   * @param query
   */
  getList(
    state: AuthContextMetadata,
    query: ContextRequest
  ): Promise<[T[], number]>;
}

export interface IGetItemDataProvider<T> {
  /**
   * Return one entity identified by id or null if it is not available.
   *
   * @param state
   * @param id
   */
  getItem(state: AuthContextMetadata, id: number): Promise<T>;
}

export interface ICreateItemDataProvider<T> {
  /**
   * Creates a new entity from the given data and returns the entity
   * including its unique id.
   *
   * @param state
   * @param data
   */
  createItem(state: AuthContextMetadata, data: T): Promise<T>;
}

export interface IUpdateItemDataProvider<T> {
  /**
   * Updates an existing entity.
   *
   * @param state
   * @param id
   * @param data
   */
  updateItem(
    state: AuthContextMetadata,
    id: number,
    data: T,
    isPartial: boolean
  ): Promise<T>;
}

export interface IDeleteItemDataProvider<T> {
  /**
   * Deletes an existing entity.
   *
   * @param state
   * @param id
   */
  deleteItem(state: AuthContextMetadata, id: number): Promise<Partial<T>>;
}

export interface IValidateDataProvider<T> {
  /**
   * Deletes an existing entity.
   *
   * @param state
   * @param id
   */
  validate(state: AuthContextMetadata, data: T[]): Promise<T[]>;
}

export interface IFindOneDataProvider<T> {
  /**
   * Find exactly one entity.
   *
   * @param state
   * @param id
   */
  findOne(state: AuthContextMetadata, id: number): Promise<T>;
}
