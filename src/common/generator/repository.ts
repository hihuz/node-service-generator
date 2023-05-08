import _ from "lodash";

import {
  Association,
  CreationAttributes,
  FindOptions,
  Op,
  ProjectionAlias,
  Transaction,
  WhereOptions,
} from "sequelize";
import { AssociationType, BelongsToManyAssociation } from "./types/sequelize";
import { Model, ModelCtor, Sequelize } from "sequelize-typescript";

import { ApplicationError } from "../errors/application-error.class";
import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ClientError } from "../errors/client-error.config";
import { ContextRequest } from "../context/context-request.class";
import { EntityStatus } from "../models/status.model";
import { FiltersGenerator } from "./filters-generator";
import Info from "../models/info.model";
import { OrderGenerator } from "./order-generator";
import { PermissionsManager } from "./permissions-manager";
import { SequelizeConnection } from "./connection";
import { TimestampsManager } from "./timestamps-manager";

type InfoAction = "created" | "deleted" | "modified";

export abstract class SequelizeRepository<
  T extends Model,
  InputDto = T["_creationAttributes"]
> {
  protected abstract model: ModelCtor<T>;
  protected softDeleteStatus: EntityStatus = EntityStatus.ARCHIVED;
  /**
   * Sequelize find options applied to all fetch queries (getItem, getList).
   */
  protected abstract fetchCondition: FindOptions;

  constructor(
    private permissionsManager: PermissionsManager<T, InputDto>,
    private filtersGenerator: FiltersGenerator<T>,
    private orderGenerator: OrderGenerator<T>,
    private timestampsManager?: TimestampsManager<T>
  ) {}

  /**
   * Get a specific database entity and return it.
   *
   * @param state AuthContextMetadata
   * @param id number | string
   * @param request ContextRequest
   * @returns Promise<T>
   */
  public async getItem(
    state: AuthContextMetadata,
    id: number | string,
    request?: ContextRequest
  ): Promise<T> {
    const condition = this.generateCondition(state, request);

    const { primaryKeyAttribute } = this.model;

    const [item] = await this.model.findAll({
      ...condition,
      where: { [Op.and]: [condition.where, { [primaryKeyAttribute]: id }] },
    });

    if (!item) {
      throw new ApplicationError(ClientError.CRUD.NOT_FOUND.ITEM_NOT_FOUND);
    }

    return item;
  }

  /**
   * Get a list of database entities and return it.
   *
   * @param state AuthContextMetadata
   * @param request ContextRequest
   * @returns Promise<[T[], number]>
   */
  public async getList(
    state: AuthContextMetadata,
    request: ContextRequest
  ): Promise<[T[], number]> {
    const page = request.getPage();
    const limit = Math.abs(request.getPageSize());
    const offset = limit * (page - 1);
    const condition = this.generateCondition(state, request);
    const order = this.orderGenerator.generateCondition(request);

    // Sequelize "group" option syntax is using literal (i.e. db) field names.
    // If the primary key of a model is aliased, 'primaryKeyAttribute' can't be used in such group option.
    // The db field name of a model is stored in 'primaryKeyField' property which isn't exposed in the sequelize type.
    // const primaryKeyField = (
    //   this.model as ModelCtor<T> & { primaryKeyField: string }
    // ).primaryKeyField;

    // 1. Get primary keys of entries matching the condition, limit, and order.
    const { rows: matchingItems, count } = await this.model.findAndCountAll({
      ...condition,
      ...order,
      limit,
      offset,
    });

    const { primaryKeyAttribute } = this.model;

    const matchingItemsCondition = {
      [primaryKeyAttribute]: {
        [Op.in]: matchingItems.map(
          (item: T & Record<string, string | number>) =>
            item[primaryKeyAttribute]
        ),
      },
    };

    // 2. Generate condition to retrieve full entries for the corresponding primary keys.
    const listResultsCondition = this.generateListResultsCondition(
      matchingItemsCondition,
      state,
      request
    );

    // 3. Retrieve full entries, keeping the same ordering.
    const items = await this.model.findAll({
      ...listResultsCondition,
      ...order,
    });

    // Sequelize types "count" as number, but when using a group by clause, it is actually an array of numbers.
    return [items, (count as unknown as number[]).length];
  }

  /**
   * Create a database entity and return it.
   *
   * @param state AuthContextMetadata
   * @param attributes T["_creationAttributes"]
   * @returns Promise<T>
   */
  public async createItem(
    state: AuthContextMetadata,
    attributes: Partial<T["_creationAttributes"]>
  ): Promise<T> {
    const sequelize = SequelizeConnection.getInstance();
    const { primaryKeyAttribute } = this.model;

    const item = (await sequelize.transaction(async (transaction) =>
      this.upsertEntity(state, this.model, attributes, transaction)
    )) as T & Record<string, string | number>;

    // The created item will not contain all of its necessary associations,
    // therefore we need to fetch the whole entity before returning it.
    const fetchedItem = await this.getItem(state, item[primaryKeyAttribute]);

    return fetchedItem;
  }

  /**
   * Update a database entity and return it.
   *
   * @param state AuthContextMetadata
   * @param id number
   * @param attributes T["_creationAttributes"]
   * @returns Promise<T>
   */
  public async updateItem(
    state: AuthContextMetadata,
    id: number,
    attributes: T["_creationAttributes"]
  ): Promise<T> {
    const sequelize = SequelizeConnection.getInstance();
    const { primaryKeyAttribute } = this.model;

    const item = (await sequelize.transaction(async (transaction) =>
      this.upsertEntity(
        state,
        this.model,
        { [primaryKeyAttribute]: id, ...attributes },
        transaction
      )
    )) as T & Record<string, string | number>;

    // The created item will not contain all of its necessary associations,
    // therefore we need to fetch the whole entity before returning it.
    const fetchedItem = await this.getItem(state, item[primaryKeyAttribute]);

    return fetchedItem;
  }

  /**
   * Delete a database entity and return it.
   *
   * @param state AuthContextMetadata
   * @param id number
   * @returns Promise<T>
   */
  public async deleteItem(state: AuthContextMetadata, id: number): Promise<T> {
    const sequelize = SequelizeConnection.getInstance();

    const item = await this.getItem(state, id);

    await sequelize.transaction(async (transaction) => {
      if ("status_id" in item) {
        // Set status_id to the configured soft delete status
        await item.update(
          { status_id: this.softDeleteStatus },
          { transaction }
        );
      } else {
        // If the entity does not have a status_id it does not have a soft delete mechanism and should be destroyed
        await item.destroy({ transaction });
      }

      // Update related info if the entity has an associated info and we are deleting the entity
      if ("info_id" in item && this.softDeleteStatus === EntityStatus.DELETED) {
        await this.upsertInfo(
          state,
          "deleted",
          transaction,
          (item as T & { info_id: number }).info_id
        );
      }
    });

    return item;
  }

  /**
   * Generate a sequelize fetching condition from the base condition
   * and extended with the updated_at literal query if applicable.
   *
   * @returns FindOptions
   */
  protected generateBaseFetchCondition(): FindOptions {
    const shouldAddTimestampsAttribute = !!this.timestampsManager;

    if (!shouldAddTimestampsAttribute) {
      return this.fetchCondition;
    }

    const updatedAtLiteral = this.timestampsManager.generateUpdatedAtLiteral();
    const baseAttributes = (this.fetchCondition.attributes || {
      include: [],
    }) as {
      exclude?: string[];
      include: (string | ProjectionAlias)[];
    };

    return {
      ...this.fetchCondition,
      attributes: {
        ...this.fetchCondition.attributes,
        include: [
          ...baseAttributes.include,
          [updatedAtLiteral, this.timestampsManager.updatedAtColumn],
        ],
      },
    };
  }

  /**
   * Generate a sequelize condition to apply to retrieve
   * the list of results for the getList method.
   *
   * @param matchingItemsCondition WhereOptions
   * @param _state AuthContextMetadata
   * @param _request ContextRequest
   * @returns FindOptions
   */
  protected generateListResultsCondition(
    matchingItemsCondition: WhereOptions,
    _state: AuthContextMetadata,
    _request: ContextRequest
  ): FindOptions {
    const baseFetchCondition = this.generateBaseFetchCondition();

    return {
      ...baseFetchCondition,
      where: { [Op.and]: [matchingItemsCondition, baseFetchCondition.where] },
    };
  }

  /**
   * Convert an entity to an array if applicable.
   *
   * @param entity EntityType | EntityType[]
   * @returns EntityType[]
   */
  protected toArray<EntityType>(
    entity?: EntityType | EntityType[]
  ): EntityType[] {
    if (!entity) {
      return [];
    }

    return Array.isArray(entity) ? entity : [entity];
  }

  /**
   * Generate a combined include clause from permissions, filters and base entity conditions.
   *
   * @param baseCondition FindOptions
   * @param permissionsCondition FindOptions
   * @param filtersCondition FindOptions
   * @returns FindOptions
   */
  protected generateIncludeClause(
    permissionsCondition: FindOptions,
    filtersCondition?: FindOptions
  ): FindOptions {
    const original = [
      ...this.toArray(this.fetchCondition.include),
      ...this.toArray(permissionsCondition.include),
      ...this.toArray(filtersCondition?.include),
    ];

    const filtered = original.filter(
      (item, index, array) =>
        index === array.findIndex((foundItem) => _.isEqual(foundItem, item))
    );

    return {
      include: filtered,
    };
  }

  /**
   * Generate a combined where clause from permissions, filters and base entity conditions.
   *
   * @param baseCondition FindOptions
   * @param permissionsCondition FindOptions
   * @param filtersCondition FindOptions
   * @returns FindOptions
   */
  protected generateWhereClause(
    permissionsCondition: FindOptions,
    filtersCondition?: FindOptions
  ): FindOptions {
    const generatedClause: FindOptions = {};

    const clauses = _.compact([
      this.fetchCondition.where,
      permissionsCondition.where,
      filtersCondition?.where,
    ]);

    if (clauses.length > 1) {
      generatedClause.where = { [Op.and]: clauses };
    }

    if (clauses.length === 1) {
      generatedClause.where = clauses[0];
    }

    return generatedClause;
  }

  /**
   * Generate the main sequelize condition to apply to a given getItem or getList call.
   * It will be built from permissions, filters, and the base condition for the entity.
   *
   * @param state AuthContextMetadata
   * @param request ContextRequest
   * @returns FindOptions
   */
  protected generateCondition(
    state: AuthContextMetadata,
    request?: ContextRequest
  ): FindOptions {
    const permissionsCondition =
      this.permissionsManager.generateCondition(state);
    const filtersCondition = this.filtersGenerator.generateCondition(
      state,
      request
    );

    const condition = {
      ...this.generateBaseFetchCondition(),
      ...this.generateIncludeClause(permissionsCondition, filtersCondition),
      ...this.generateWhereClause(permissionsCondition, filtersCondition),
    };

    return condition;
  }

  /**
   * Return the target model corresponding to an association.
   *
   * @param association
   * @returns ModelCtor
   */
  protected getTargetModel(association: Association): ModelCtor {
    return association.target as ModelCtor;
  }

  /**
   * Determine if a given relation is many to many.
   *
   * @param association
   * @returns Association | BelongsToManyAssociation
   */
  protected isManyToManyRelation(
    association: Association
  ): association is BelongsToManyAssociation {
    return association.associationType === AssociationType.BELONGS_TO_MANY;
  }

  /**
   * Return the relation model for a given association.
   * This will be the target model for a regular association or the 'through' model for a many to many relation.
   *
   * @param association
   * @returns
   */
  protected getRelationModel(association: Association): ModelCtor {
    return this.isManyToManyRelation(association)
      ? association.through.model
      : this.getTargetModel(association);
  }

  /**
   * Remove relations for a given type of association.
   *
   * One of these operations will be performed depending on the relationship:
   * - If the foreignKey is nullable on the association, nullify it.
   * - If the foreignKey is not nullable and the relation model has a status_id, set status as deleted.
   * - If the foreignKey is not nullable and the relation model does not have a status_id, destroy the entries.
   *
   * @param sourcePrimaryKey string
   * @param association Association
   * @param transaction Transaction
   * @return Promise<void>
   */
  protected async removeRelations(
    sourcePrimaryKey: string,
    association: Association,
    transaction: Transaction
  ): Promise<void> {
    const relationModel = this.getRelationModel(association);

    const where = {
      [association.foreignKey]: sourcePrimaryKey,
    };

    // The associated model has a FK to the source model
    if (relationModel.rawAttributes[association.foreignKey].allowNull) {
      // The FK is nullable, we can undo their relation by nulling it
      await relationModel.update(
        { [association.foreignKey]: null },
        { where, transaction }
      );
    } else if (!!relationModel.rawAttributes.status_id) {
      // The FK is not nullable, but the associated model has a 'status', we can mark it as deleted
      await relationModel.update(
        { status_id: EntityStatus.DELETED },
        {
          where,
          transaction,
        }
      );
    } else {
      // The FK is not nullable, and the association does not have a status, it's safe to destroy it
      await relationModel.destroy({
        where,
        transaction,
      });
    }
  }

  /**
   * Recursively upsert an entity and its relevant relations provided in the attributes.
   *
   * 1. Upsert associations for which the FK is on the source model.
   * 2. Upsert the source model with base attributes and FKs from step 1.
   * 3. Handle associations for which the FK is on the target model and that are of array type:
   *      - Remove existing relations
   *      - For many to many relations, update the target relation if applicable
   *        (i.e. if some attributes are in the payload for this entity).
   *      - For many to many relations, create join table entries with the provided
   *        id OR with the id resulting of the above target relation update.
   *      - For has many relations, upsert entries with PK from step 2 as FK.
   *
   * @param state AuthContextMetadata
   * @param model ModelCtor<U>
   * @param attributes U["_creationAttributes"]
   * @param transaction Transaction
   * @returns Promise<U>
   */
  protected async upsertEntity<U extends Model>(
    state: AuthContextMetadata,
    model: ModelCtor<U>,
    attributes: U["_creationAttributes"],
    transaction: Transaction
  ): Promise<U> {
    const validAttributes = _.pickBy(
      attributes,
      (value) => value !== undefined
    );
    const baseAttributes = _.pick(
      validAttributes,
      Object.keys(model.rawAttributes)
    );
    const associationsAttributes = _.pick(
      validAttributes,
      Object.keys(model.associations)
    );

    const [foreignKeyOnSourceAssociations, foreignKeyOnTargetAssociations] =
      _.partition(
        Object.entries(associationsAttributes),
        ([associationName]) =>
          model.associations[associationName].foreignKey in model.rawAttributes
      );

    const foreignKeyAttributes: Record<string, any> = {};

    // Upsert associations for which the foreign key is on the source model
    for (const [
      associationName,
      associationAttributes,
    ] of foreignKeyOnSourceAssociations) {
      const association = model.associations[associationName];
      const relationModel = this.getRelationModel(association);

      const entity = await this.upsertEntity(
        state,
        relationModel,
        associationAttributes,
        transaction
      );

      foreignKeyAttributes[association.foreignKey] =
        entity[relationModel.primaryKeyAttribute as keyof typeof entity];
    }

    const isUpdate = model.primaryKeyAttribute in baseAttributes;

    // Create info entry if applicable
    if ("info_id" in model.rawAttributes && !isUpdate) {
      const info = await this.upsertInfo(state, "created", transaction);
      foreignKeyAttributes.info_id = info.id;
    }

    // Upsert the source model with provided attributes and generated foreign key attributes
    const upsertAttributes = {
      ...baseAttributes,
      ...foreignKeyAttributes,
    } as CreationAttributes<U>;
    let entity: U & Record<string, any>;

    if (!isUpdate) {
      entity = await model.create(upsertAttributes, { transaction });
    } else {
      entity = await model.findByPk(baseAttributes[model.primaryKeyAttribute], {
        transaction,
      });

      if (!entity) {
        throw new ApplicationError({
          code: 500,
          error: "Internal Server Error",
          message: `Unable to find entity to update: ${
            baseAttributes[model.primaryKeyAttribute]
          }`,
        });
      }

      await entity.update(upsertAttributes, { transaction });
    }

    // Update info entry if applicable
    if ("info_id" in model.rawAttributes && isUpdate) {
      await this.upsertInfo(state, "modified", transaction, entity.info_id);
    }

    const sourcePrimaryKey = entity[model.primaryKeyAttribute];

    // Upsert associations for which the foreign key is on the target model
    for (const [
      associationName,
      associationAttributes,
    ] of foreignKeyOnTargetAssociations) {
      const association = model.associations[associationName];

      const relationModel = this.getRelationModel(association);

      // The association to update is an array, it will be handled by
      // clearing existing relations of this type and creating new entries
      if (Array.isArray(associationAttributes)) {
        const where = {
          [association.foreignKey]: sourcePrimaryKey,
        };

        // The associated model has a FK to the source model, we can undo the corresponding relations
        await this.removeRelations(sourcePrimaryKey, association, transaction);

        for (const attributesEntry of associationAttributes as Record<
          string,
          any
        >[]) {
          if (this.isManyToManyRelation(association)) {
            const targetModel = this.getTargetModel(association);
            const targetPrimaryKeyAttribute = targetModel.primaryKeyAttribute;

            const targetPrimaryKey =
              attributesEntry[targetPrimaryKeyAttribute] ||
              (
                (await this.upsertEntity(
                  state,
                  targetModel,
                  attributesEntry,
                  transaction
                )) as Model & Record<string, any>
              )[targetPrimaryKeyAttribute];

            await relationModel.create(
              {
                [association.foreignKey]: sourcePrimaryKey,
                [association.otherKey]: targetPrimaryKey,
                ...attributesEntry.through,
              },
              { transaction }
            );
          } else {
            await this.upsertEntity(
              state,
              relationModel,
              { ...attributesEntry, ...where },
              transaction
            );
          }
        }
      } else {
        await this.upsertEntity(
          state,
          relationModel,
          {
            ...associationAttributes,
            [association.foreignKey]: sourcePrimaryKey,
          },
          transaction
        );
      }
    }

    return entity;
  }

  /**
   * Upsert an info entry corresponding to a given entity
   *
   * @param state AuthContextMetadata
   * @param action InfoAction
   * @param transaction Transaction
   * @param id number
   * @returns Promise<Info>
   */
  protected async upsertInfo(
    state: AuthContextMetadata,
    action: InfoAction,
    transaction: Transaction,
    id?: number
  ): Promise<Info> {
    const metadata = state.getMetadata();

    const userId = metadata.internal?.id;

    const payload = {
      [`${action}_at`]: Sequelize.fn("NOW"),
      ...(userId ? { [`${action}_by_id`]: userId } : {}),
      ...(id ? { id } : {}),
    };

    const result = await Info.upsert(payload, { transaction });

    return result[0];
  }
}
