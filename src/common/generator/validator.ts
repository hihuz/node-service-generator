import * as _ from "lodash";

import { Model, ModelCtor } from "sequelize-typescript";

import { ApplicationError } from "../errors/application-error.class";
import { Association } from "sequelize";
import { AssociationType } from "./types/sequelize";
import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ClientError } from "../errors/client-error.config";
import { Op } from "sequelize";

export abstract class Validator<
  T extends Model,
  InputDto extends Record<string, any> = Record<string, any>
> {
  protected abstract model: ModelCtor<T>;
  protected immutablePaths: string[] = [];
  protected associationModelMapping: Record<string, string> = {};

  /**
   * Validate a given property for an entity is not changed in an update's input.
   *
   * @param input Partial<InputDto>
   * @param record InputDto
   * @param path string
   * @returns void
   */
  public validateImmutableField(
    input: Partial<InputDto>,
    record: InputDto,
    path: string
  ): void {
    const inputValue = _.get(input, path);
    const existingValue = _.get(record, path);

    if (_.isNil(existingValue) || _.isUndefined(inputValue)) {
      return;
    }

    if (!_.isEqual(existingValue, inputValue)) {
      throw new ApplicationError(
        _.merge(ClientError.CRUD.BAD_REQUEST.VALIDATION_IMMUTABLE_FIELD, {
          params: { field: path },
        })
      );
    }
  }

  /**
   * Validate immutable properties for an entity are not changed in an update's input.
   *
   * @param input Partial<InputDto>
   * @param record InputDto
   * @returns void
   */
  public validateImmutableFields(
    input: Partial<InputDto>,
    record: InputDto
  ): void {
    for (const path of this.immutablePaths) {
      this.validateImmutableField(input, record, path);
    }
  }

  /**
   * Additional custom validation to perform for the specific type of entity.
   *
   * @param completeInput  User's provided input for entity creation.
   *                        Resulting merge of user's input and existing item being updated for entity updates.
   *                        Use this to perform validations that should apply both for creation and update.
   * @param state          AuthContextMetadata
   * @param existingItem   The serialized existing entity, only passed for updates.
   *                        Use this if you need to perform validation between the existing state
   *                        of an entity and the new values provided by the user
   * @param userInput      User's provided input, only passed for updates.
   *                        Use this if you need to perform validation between the existing state
   *                        of an entity and the new values provided by the user.
   * @returns               Promise<void>
   */
  public async validateInput(_options: {
    completeInput: InputDto;
    state: AuthContextMetadata;
    existingItem?: InputDto;
    userInput?: Partial<InputDto>;
  }): Promise<void> {
    return;
  }

  /**
   * Validate existence and status of specified input entity relations.
   *
   * @param input InputDto
   * @returns Promise<void>
   */
  public async validateRelations(input: InputDto): Promise<void> {
    const validAttributes = _.pickBy(input, (value) => value !== undefined);
    const associationNames = _.intersection(
      Object.keys(validAttributes),
      Object.keys(this.model.associations)
    );

    for (const associationName of associationNames) {
      const association =
        this.model.associations[
          _.get(this.associationModelMapping, associationName, associationName)
        ];
      const associatedModel = association.target;

      if (!this.shouldValidateAssociation(input, association)) {
        continue;
      }

      if (
        [AssociationType.BELONGS_TO, AssociationType.HAS_ONE].includes(
          association.associationType as AssociationType
        )
      ) {
        const primaryKeyAttribute = association.target.primaryKeyAttribute;
        const primaryKey = input[associationName][primaryKeyAttribute];
        const entity = await associatedModel.findByPk(primaryKey);

        if (!entity) {
          throw new ApplicationError(
            _.merge(ClientError.CRUD.BAD_REQUEST.VALIDATION_INVALID_RELATION, {
              params: { field: associationName },
            })
          );
        }
      } else {
        const inputIds = input[associationName].map(
          ({ id }: { id: number }) => id
        );
        const entities = await associatedModel.findAll({
          where: {
            [associatedModel.primaryKeyAttribute]: { [Op.in]: inputIds },
          },
        });

        if (entities.length !== inputIds.length) {
          throw new ApplicationError(
            _.merge(ClientError.CRUD.BAD_REQUEST.VALIDATION_INVALID_RELATION, {
              params: { field: associationName },
            })
          );
        }
      }
    }
  }

  /**
   * Safely check for a property corresponding to a model's primary key on an entity of unknown type.
   *
   * @param entry unknown
   * @returns boolean
   */
  protected hasPrimaryKey(
    entry: unknown,
    primaryKeyAttribute: string
  ): boolean {
    return _.isObject(entry) && primaryKeyAttribute in entry;
  }

  /**
   * Evaluate if we should validate the existence of a given input association,
   * i.e. if an id was provided for this association's input.
   *
   * @param input InputDto
   * @param association Association
   * @returns boolean
   */
  protected shouldValidateAssociation(
    input: InputDto,
    association: Association
  ): boolean {
    const associationName = association.as;
    const primaryKeyAttribute = association.target.primaryKeyAttribute;

    if (Array.isArray(input[association.as])) {
      return input[associationName].every((inputValue: unknown) =>
        this.hasPrimaryKey(inputValue, primaryKeyAttribute)
      );
    }

    return this.hasPrimaryKey(input[associationName], primaryKeyAttribute);
  }
}
