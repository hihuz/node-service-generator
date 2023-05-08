import _ from "lodash";

import {
  Association,
  FindOptions,
  IncludeOptions,
  Includeable,
  Op,
  Sequelize,
  Utils,
  WhereOptions,
} from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

import { ApplicationError } from "../errors/application-error.class";
import { AssociationBuilder } from "./association-builder";
import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ClientError } from "../errors/client-error.config";
import { ServerError } from "../errors/server-error.config";

export type PermissionDefinition = {
  /**
   * The token metadata key to validate against.
   * If the model has this key as an attribute or an association, it will be used directly.
   * Otherwise a 'path' to the corresponding attribute or key must be specified.
   */
  key: string;
  /**
   * Custom logic to determine if this definition should
   * apply based on some auth token metadata values.
   *
   * If not specified the definition always applies.
   */
  shouldApply?: (state: AuthContextMetadata) => boolean;
};

export type PermissionsDefinitions = PermissionDefinition[];

const DEFAULT_PERMISSIONS_DEFINITIONS: PermissionsDefinitions = [
  { key: "market_place" },
];

export abstract class PermissionsManager<
  T extends Model,
  InputDto = T["_creationAttributes"]
> extends AssociationBuilder<T> {
  protected abstract model: ModelCtor<T>;
  /**
   * A map of metadata keys which can't be converted automatically to a series of model associations for a given entity.
   *
   * Example:
   * - BaseEntity belongs to Product (as 'product'), Product belongs to SupplyNetwork (as 'market_place')
   * - The metadata key for this permission is 'market_place'
   * - The correct path to market_place can't be inferred automatically, so we need to provide it specifically like so:
   *   { 'market_place': 'product.market_place.id' }
   */
  protected pathMap: Record<string, string | Utils.Literal> = {};
  protected definitions: PermissionsDefinitions =
    DEFAULT_PERMISSIONS_DEFINITIONS;
  protected associationError =
    ServerError.CRUD.INTERNAL_SERVER_ERROR.INVALID_PERMISSION_DEFINITION;
  protected restrictions: WhereOptions[] = [];
  protected includes: Includeable[] = [];

  /**
   * Generate a sequelize condition to filter a given entity by a restricted
   * list of ids if there is a matching permission definition for it.
   * Used for getItem and getList Loader methods.
   *
   * @param state AuthContextMetadata
   * @returns FindOptions
   */
  public generateCondition(state: AuthContextMetadata): FindOptions {
    const metadata = state.getMetadata();

    const matchingDefinitions = this.definitions.filter(
      (definition) => !definition.shouldApply || definition.shouldApply(state)
    );

    for (const { key } of matchingDefinitions) {
      const path = this.serializeKey(key);
      const column = this.pathMap[path] || path;

      this.extractAndValidatePathData(path);

      const value = Array.isArray(metadata[key])
        ? metadata[key]
        : [metadata[key]];

      const restriction =
        column instanceof Utils.Literal
          ? Sequelize.where(column, { [Op.in]: value })
          : { [this.serializeColumnName(column)]: { [Op.in]: value } };

      this.restrictions.push(restriction);
    }

    return {
      ...(this.restrictions.length
        ? { where: { [Op.and]: this.restrictions } }
        : {}),
      ...(this.includes.length ? { include: this.includes } : {}),
    };
  }

  /**
   * Permissions validator for read operations.
   *
   * For read operations, access to restricted entities will be applied to the select queries,
   * therefore the default validator does not need to perform additional checks.
   *
   * @param _state AuthContextMetadata, unused in the default validator
   * @param _id identifier for the entity being accessed, unused in the default validator
   * @returns
   */
  public async validateReadPermissions(
    _state: AuthContextMetadata,
    _id?: number
  ): Promise<void> {
    return;
  }

  /**
   * Permissions validator for create operations.
   *
   * @param state AuthContextMetadata
   * @param input request payload for the entity to create
   */
  public async validateCreatePermissions(
    state: AuthContextMetadata,
    input: InputDto
  ): Promise<void> {
    const metadata = state.getMetadata();

    for (const { shouldApply, key } of this.definitions) {
      const applies = !shouldApply || shouldApply(state);

      // Skip this definition as it does not apply to the current user
      if (!applies) {
        continue;
      }

      const path = this.serializeKey(key);
      const { field, associations } = this.extractAndValidatePathData(path);

      const directAssociation = associations[0];

      if (!directAssociation) {
        console.error(
          `[validateCreatePermissions] No direct association was found for ${key} permission definition of ${this.model.name}.
                    Consider double checking your paths or overriding this method.`
        );

        return;
      }

      const primaryKey = directAssociation.target.primaryKeyAttribute;
      const associationName = directAssociation.as;

      const inputPath = `${associationName}.${primaryKey}`;

      // Extract direct association primary key from input
      const primaryKeyValue = _.get(input, inputPath);

      if (!primaryKeyValue) {
        console.error(
          `[validateCreatePermissions] No id could be extracted from input for ${key} permission definition of ${this.model.name}.
                    Consider double checking your paths or overriding this method.`
        );

        return;
      }

      const permissionValue = Array.isArray(metadata[key])
        ? metadata[key]
        : [metadata[key]];

      // Build the permission restriction condition to apply to the lookup query
      const condition = this.buildValidationCondition(
        associations.slice(1),
        field,
        permissionValue,
        {
          [primaryKey]: primaryKeyValue,
        }
      );

      // Look for a matching entity restricted by this permission
      const entity = await directAssociation.target
        .unscoped()
        .findOne(condition);

      if (!entity) {
        throw new ApplicationError(
          _.merge(ClientError.AUTH.FORBIDDEN.NO_ACCESS, {
            params: { key, value: primaryKeyValue },
          })
        );
      }
    }
  }

  /**
   * Permissions validator for delete operations.
   *
   * @param state AuthContextMetadata
   * @param id identifier for the entity being accessed
   */
  public async validateDeletePermissions(
    state: AuthContextMetadata,
    id: number
  ): Promise<void> {
    await this.validateUpdateOrDeletePermissions(state, id);
  }

  /**
   * Permissions validator for update operations.
   *
   * @param state AuthContextMetadata
   * @param id identifier for the entity being accessed
   */
  public async validateUpdatePermissions(
    state: AuthContextMetadata,
    id: number
  ): Promise<void> {
    await this.validateUpdateOrDeletePermissions(state, id);
  }

  /**
   * Permissions validator for update and delete operations.
   *
   * @param state AuthContextMetadata
   * @param id identifier for the entity being accessed
   */
  protected async validateUpdateOrDeletePermissions(
    state: AuthContextMetadata,
    id: number
  ): Promise<void> {
    const metadata = state.getMetadata();

    for (const { shouldApply, key } of this.definitions) {
      const applies = !shouldApply || shouldApply(state);

      // Skip this definition as it does not apply to the current user
      if (!applies) {
        continue;
      }

      const permissionValue = Array.isArray(metadata[key])
        ? metadata[key]
        : [metadata[key]];
      const path = this.serializeKey(key);
      const { field, associations } = this.extractAndValidatePathData(path);
      const primaryKey = this.model.primaryKeyAttribute;

      // Build the permission restriction condition to apply to the lookup query
      const condition = this.buildValidationCondition(
        associations,
        field,
        permissionValue,
        {
          [primaryKey]: id,
        }
      );

      // Look for a matching entity restricted by this permission
      const entity = await this.model.unscoped().findOne(condition);

      if (!entity) {
        throw new ApplicationError(ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS);
      }
    }
  }

  /**
   * Build a sequelize condition to restrict results of
   * a permission validation to the authorized entities.
   *
   * @param associations Association[]
   * @param field string
   * @param value (string | number)[]
   * @param primaryKeyClause: Record<string, string | number>
   * @returns IncludeOptions
   */
  protected buildValidationCondition(
    associations: Association[],
    field: string | Utils.Literal,
    value: (string | number)[],
    primaryKeyClause: Record<string, string | number>
  ): IncludeOptions {
    const { where, include } = associations.reduceRight<{
      where?: Record<string, any>;
      include?: IncludeOptions[];
    }>(
      (includeOptions, association) => ({
        include: [
          {
            ...includeOptions,
            model: association.target.unscoped(),
            required: true,
          },
        ],
      }),
      {
        where:
          field instanceof Utils.Literal
            ? Sequelize.where(field, { [Op.in]: value })
            : { [field]: { [Op.in]: value } },
      }
    );

    const condition = {
      where: where ? { [Op.and]: [primaryKeyClause, where] } : primaryKeyClause,
      ...(include ? { include } : {}),
    };

    return condition;
  }

  /**
   * Attempt to infer the path to a metadata key by appending a '.${primaryKey}' suffix
   * if it does not have a custom path, and is not a direct attribute of the model.
   *
   * @param key string
   * @returns string
   */
  protected serializeKey = (key: string): string => {
    const hasCustomPath = key in this.pathMap;
    const isAttribute = key in this.model.rawAttributes;
    const isAssociation = key in this.model.associations;

    if (hasCustomPath || isAttribute || !isAssociation) {
      return key;
    }

    const primaryKeyAttribute =
      this.model.associations[key].target.primaryKeyAttribute;

    return `${key}.${primaryKeyAttribute}`;
  };
}
