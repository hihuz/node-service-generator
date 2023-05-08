import _ from "lodash";

import {
  DataType,
  DataTypes,
  FindOptions,
  Includeable,
  Sequelize,
  Utils,
  WhereOptions,
} from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

import { ApplicationError } from "../errors/application-error.class";
import { AssociationBuilder } from "./association-builder";
import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { ClientError } from "../errors/client-error.config";
import { ContextRequest } from "../context/context-request.class";
import { Op } from "sequelize";
import { TimestampsManager } from "./timestamps-manager";

export const VALID_OPERATORS = [
  "eq",
  "like",
  "gt",
  "gte",
  "lt",
  "lte",
  "ne",
  "in",
  "notIn",
  "is",
  "not",
] as const;

const DEFAULT_SEARCH_FIELDS = ["id", "name"];

export abstract class FiltersGenerator<
  T extends Model
> extends AssociationBuilder<T> {
  protected abstract model: ModelCtor<T>;

  protected searchFields = DEFAULT_SEARCH_FIELDS;
  protected associationError =
    ClientError.CRUD.BAD_REQUEST.INVALID_FILTER_PARAMETER;
  protected operatorMap: Record<string, (typeof VALID_OPERATORS)[number]> = {
    ge: "gte",
    le: "lte",
    ct: "like",
    isNot: "not",
  };
  protected filters: WhereOptions[] = [];
  protected includes: Includeable[] = [];

  constructor(private timestampsManager?: TimestampsManager<T>) {
    super();
  }

  /**
   * Generate a sequelize condition from a request's filter parameters.
   *
   * @param _state AuthContextMetadata
   * @param request ContextRequest
   * @returns FindOptions | undefined
   */
  public generateCondition(
    _state: AuthContextMetadata,
    request?: ContextRequest
  ): FindOptions | undefined {
    if (!request) {
      return;
    }

    const filters: string[] = request.getArray("filter");

    if (filters.length) {
      this.buildFilters(filters);
    }

    const search: string | undefined = request.getString("q");

    if (search) {
      this.buildSearchFilter(search);
    }

    return {
      ...(this.filters.length ? { where: { [Op.and]: this.filters } } : {}),
      ...(this.includes.length ? { include: this.includes } : {}),
    };
  }

  /**
   * Validate filter specific operator and value combinations.
   *
   * @param value
   * @param operator
   * @returns void
   */
  protected validateFilter(
    value: string,
    operator: (typeof VALID_OPERATORS)[number]
  ): void {
    if (!VALID_OPERATORS.includes(operator)) {
      throw new ApplicationError(
        _.merge(ClientError.CRUD.BAD_REQUEST.INVALID_FILTER_OPERATOR, {
          params: { operator },
        })
      );
    }

    if (operator === "is" && !["null", "empty"].includes(value)) {
      throw new ApplicationError(
        ClientError.CRUD.BAD_REQUEST.INVALID_IS_OPERATOR
      );
    }
  }

  /**
   * Generate a sequelize filter condition from values
   * received as query parameters
   *
   * @param column string | Utils.Literal
   * @param value string
   * @param operator "eq" | "like" | "gt" | "gte" | "lt" | "lte" | "ne" | "in" | "is" | "notIn"
   * @param fieldType DataType
   * @returns WhereOptions
   */
  protected generateFilter(
    column: string | Utils.Literal,
    value: string,
    operator: (typeof VALID_OPERATORS)[number],
    fieldType: DataType = DataTypes.BOOLEAN.key
  ): WhereOptions {
    const type = typeof fieldType === "string" ? fieldType : fieldType.key;

    let serializedValue:
      | string
      | boolean
      | number
      | string[]
      | number[]
      | null = value;
    let serializedOperator: (typeof VALID_OPERATORS)[number] = operator;

    if (type === DataTypes.BOOLEAN.key) {
      if (value === "true") {
        serializedValue = true;
      }

      if (value === "false") {
        serializedValue = false;
      }
    }

    if (operator === "like") {
      serializedValue = `%${value}%`;
    }

    if (["is", "not"].includes(operator)) {
      if (value === "null") {
        serializedValue = null;
      }

      if (value === "empty") {
        serializedValue = "";
      }
    }

    if (operator === "is" && value === "empty") {
      serializedOperator = "eq";
    }

    if (operator === "in" || operator === "notIn") {
      serializedValue = value.split(/\s*,\s*/);
    }

    const filterValue = { [Op[serializedOperator]]: serializedValue };

    return column instanceof Utils.Literal
      ? Sequelize.where(column, filterValue)
      : { [this.serializeColumnName(column)]: filterValue };
  }

  /**
   * Store an array of sequelize conditions to apply to
   * select clauses based on a received list of API filters.
   *
   * @param filters string[]
   * @returns void
   */
  protected buildFilters(filters: string[]): void {
    for (const filter of filters) {
      const filterValue = this.buildFilter(filter);

      this.filters.push(filterValue);
    }
  }

  /**
   * Store a sequelize condition to filter results based on the received
   * search query parameter and the defined list of searchFields.
   *
   * @param search string
   * @returns void
   */
  protected buildSearchFilter(search: string): void {
    const searchConditions = this.searchFields.map((field) =>
      this.buildFilter(`${field} ct ${search}`)
    );

    this.filters.push({ [Op.or]: searchConditions });
  }

  /**
   * Verify validity of a filter string and format it to a sequelize condition.
   *
   * @param filter string
   * @returns WhereOptions
   */
  protected buildFilter(filter: string): WhereOptions {
    const [queryPath, queryOperator, ...rest] = filter.split(/\s/);

    const value = rest.join(" ");
    const operator =
      this.operatorMap[queryOperator] ||
      (queryOperator as (typeof VALID_OPERATORS)[number]);

    if (
      ["updated_since", "updated_at"].includes(queryPath) &&
      !!this.timestampsManager
    ) {
      return this.timestampsManager.generateUpdatedAtFilter(
        value,
        operator,
        queryPath
      );
    }

    const { associations, field } = this.extractAndValidatePathData(queryPath);

    if (field instanceof Utils.Literal) {
      return this.generateFilter(field, value, operator);
    }

    const filterModel = this.getLastAssociationModel(associations);

    const databaseField = filterModel.rawAttributes[field].field;
    const column = [
      ...associations.map((association) => association.as),
      databaseField,
    ].join(".");

    this.validateFilter(value, operator);

    const fieldType = filterModel.rawAttributes[field].type;

    return this.generateFilter(column, value, operator, fieldType);
  }
}
