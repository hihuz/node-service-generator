import { ApplicationError } from "../errors/application-error.class";
import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { BaseDataProvider } from "../dataprovider/base-dataprovider";
import { ClientError } from "../errors/client-error.config";
import { ContextRequest } from "../context/context-request.class";
import { Validator } from "./validator";
import { Model } from "sequelize-typescript";
import { Serializer } from "./serializer";
import { PermissionsManager } from "./permissions-manager";
import { SequelizeRepository } from "./repository";

export abstract class SequelizeDataProvider<
  T extends Model,
  InputDto = T["_creationAttributes"],
  ResponseDto = InputDto
> extends BaseDataProvider {
  public constructor(
    protected repository: SequelizeRepository<T>,
    protected serializer: Serializer<T, InputDto, ResponseDto>,
    protected validator: Validator<T>,
    protected permissionsManager: PermissionsManager<T, InputDto>
  ) {
    super();
  }

  /**
   * Validate permissions and return the requested list of items.
   *
   * @param state AuthContextMetadata
   * @param request ContextRequest
   * @returns Promise<[ResponseDto[], number]>
   */
  public async getList(
    state: AuthContextMetadata,
    request: ContextRequest
  ): Promise<[ResponseDto[], number]> {
    await this.permissionsManager.validateReadPermissions(state);

    try {
      const [items, count] = await this.repository.getList(state, request);

      const response = items.map((item) =>
        this.serializer.serialize(item, state)
      );

      return [response, count];
    } catch (err) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.UNABLE_TO_LIST,
        err
      );
    }
  }

  /**
   * Validate permissions and return the requested item.
   *
   * @param state AuthContextMetadata
   * @param id number
   * @returns Promise<ResponseDto>
   */
  public async getItem(
    state: AuthContextMetadata,
    id: number
  ): Promise<ResponseDto> {
    await this.permissionsManager.validateReadPermissions(state, id);

    try {
      const item = await this.repository.getItem(state, id);

      return this.serializer.serialize(item, state);
    } catch (err) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.UNABLE_TO_GET,
        err
      );
    }
  }

  /**
   * Validate permissions and create a new item.
   *
   * @param state AuthContextMetadata
   * @param input InputDto
   *
   * @returns Promise<ResponseDto>
   */
  public async createItem(
    state: AuthContextMetadata,
    input: InputDto
  ): Promise<ResponseDto> {
    await this.permissionsManager.validateCreatePermissions(state, input);

    try {
      await this.validator.validateRelations(input);

      await this.validator.validateInput({ completeInput: input, state });

      await this.beforeCreate({ input, state });

      const creationAttributes = await this.serializer.deserialize(
        input,
        state
      );

      const baseCreatedItem = await this.repository.createItem(
        state,
        creationAttributes
      );

      const createdItem = await this.afterCreate({
        createdItem: baseCreatedItem,
        input,
        state,
      });

      return this.serializer.serialize(createdItem, state);
    } catch (err) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.UNABLE_TO_CREATE,
        err
      );
    }
  }

  /**
   * Validate permissions and update an existing item.
   *
   * @param state AuthContextMetadata
   * @param id number
   * @param input InputDto
   * @param isPartial boolean
   *
   * @returns Promise<ResponseDto>
   */
  public async updateItem(
    state: AuthContextMetadata,
    id: number,
    input: Partial<InputDto>,
    isPartial: boolean
  ): Promise<ResponseDto> {
    await this.permissionsManager.validateUpdatePermissions(state, id);

    try {
      const item = await this.getItem(state, id);

      this.validator.validateImmutableFields(input, item);

      await this.validator.validateRelations(input);

      const completeInput = isPartial
        ? this.partialMerge(item, input)
        : { ...input, id };

      await this.validator.validateInput({
        completeInput,
        state,
        existingItem: item,
        userInput: input,
      });

      const updatedInput = await this.beforeUpdate({
        input,
        id,
        existingItem: item,
        state,
      });

      const updateAttributes = await this.serializer.deserialize(
        updatedInput,
        state,
        item
      );

      const baseUpdatedItem = await this.repository.updateItem(
        state,
        id,
        updateAttributes
      );

      const updatedItem = await this.afterUpdate({
        updatedItem: baseUpdatedItem,
        input,
        id,
        itemBeforeUpdate: item,
        state,
      });

      return this.serializer.serialize(updatedItem, state);
    } catch (err) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.UNABLE_TO_UPDATE,
        err
      );
    }
  }

  /**
   * Validate permissions and delete the requested item.
   *
   * @param state AuthContextMetadata
   * @param id number
   * @returns Promise<ResponseDto>
   */
  public async deleteItem(
    state: AuthContextMetadata,
    id: number
  ): Promise<ResponseDto> {
    await this.permissionsManager.validateDeletePermissions(state, id);

    try {
      const item = await this.repository.deleteItem(state, id);

      return this.serializer.serialize(item, state);
    } catch (err) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.UNABLE_TO_DELETE,
        err
      );
    }
  }

  /**
   * Hook to perform side effects before the creation of an item.
   *
   * Return the input to be used for item creation.
   *
   * @param input The request payload provided by the user
   * @param _state AuthContextMetadata
   * @returns Promise<Partial<InputDto>>
   */
  protected async beforeCreate(options: {
    input: Partial<InputDto>;
    state: AuthContextMetadata;
  }): Promise<Partial<InputDto>> {
    return options.input;
  }

  /**
   * Hook to perform side effects after the creation of an item.
   *
   * Return the model instance to be serialized and returned as API result.
   *
   * @param createdItem The created model instance
   * @param input The request payload provided by the user
   * @param state AuthContextMetadata
   * @returns Promise<T>
   */
  protected async afterCreate(options: {
    createdItem: T;
    input: Partial<InputDto>;
    state: AuthContextMetadata;
  }): Promise<T> {
    return options.createdItem;
  }

  /**
   * Hook to perform side effects before the update of an item.
   *
   * Return the input to be used for the update.
   *
   * @param input The request payload provided by the user
   * @param id The id of the item being updated
   * @param existingItem The serialized item that will be updated
   * @param state AuthContextMetadata
   * @returns Promise<Partial<InputDto>>
   */
  protected async beforeUpdate(options: {
    input: Partial<InputDto>;
    id: number;
    existingItem: Partial<ResponseDto>;
    state: AuthContextMetadata;
  }): Promise<Partial<InputDto>> {
    return options.input;
  }

  /**
   * Hook to perform side effects after the update of an item.
   *
   * Return the model instance to be serialized and returned as API result.
   *
   * @param updatedItem The updated model instance
   * @param userInput The input (request payload) provided by the user
   * @param id The id of the item being updated
   * @param itemBeforeUpdate The serialized item before the update was executed
   * @param state AuthContextMetadata
   * @returns Promise<T>
   */
  protected async afterUpdate(options: {
    updatedItem: T;
    input: Partial<InputDto>;
    id: number;
    itemBeforeUpdate: Partial<ResponseDto>;
    state: AuthContextMetadata;
  }): Promise<T> {
    return options.updatedItem;
  }
}
