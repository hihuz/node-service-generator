import * as _ from "lodash";
import * as moment from "moment";

import { Model, ModelCtor } from "sequelize-typescript";
import { Op, Sequelize, Utils } from "sequelize";

import { ApplicationError } from "../errors/application-error.class";
import { ClientError } from "../errors/client-error.config";
import { ServerError } from "../errors/server-error.config";
import { VALID_OPERATORS } from "./filters-generator";

interface UpdatedAtHierarchy {
  model: ModelCtor<any>;
  include?: UpdatedAtHierarchy[];
}

export abstract class TimestampsManager<T extends Model> {
  protected abstract model: ModelCtor<T>;

  /**
   * Hierarchy of models used to resolve the correct updated_at value for an entity.
   *
   * All updated_at values of timestamped models present in the hierarchy will be extracted,
   * and the latest value will be used as the updated_at value of the entity.
   */
  protected updatedAtHierarchy: UpdatedAtHierarchy[] = [];

  public updatedAtColumn = "updated_at";

  /**
   * Extract the updated_at column for a given model
   *
   * @param model ModelCtor
   * @returns string
   */
  private getUpdatedAtColumn(model: ModelCtor): string {
    return typeof model.options.updatedAt === "string"
      ? model.options.updatedAt
      : "updated_at";
  }

  private isISOFormat(date: string) {
    return moment(date, moment.ISO_8601).isValid();
  }

  /**
   * Return the association name of a source model to a given target model.
   *
   * @param sourceModel ModelCtor
   * @param targetModel ModelCtor
   * @returns string
   */
  private extractAssociationName(
    sourceModel: ModelCtor,
    targetModel: ModelCtor
  ): string {
    const association = Object.values(sourceModel.associations).find(
      (association) => association.target === targetModel
    );

    if (!association) {
      throw new ApplicationError(
        _.merge(
          ServerError.CRUD.INTERNAL_SERVER_ERROR.INVALID_UPDATED_AT_HIERARCHY,
          {
            params: { source: sourceModel.name, target: targetModel.name },
          }
        )
      );
    }

    return association.as;
  }

  /**
   * Recursively generate column names for the various updated_at fields to be considered.
   *
   * @param hierarchy The current hierarchy being mapped to column names
   * @param path The path of the current model being mapped
   * @param columns The mapped column names
   * @param separator The separator to use to generate column names
   * @param affix The affix to use to wrap the column names
   * @returns
   */
  protected getUpdatedAtColumns({
    hierarchy = {
      model: this.model,
      include: this.updatedAtHierarchy,
    },
    path,
    columns = [],
    separator = ".",
    affix = "",
  }: {
    hierarchy?: UpdatedAtHierarchy;
    path?: string;
    columns?: string[];
    separator?: string;
    affix?: string;
  }): string[] {
    if (hierarchy.model.options.timestamps) {
      const tableAffix = !affix ? "`" : "";
      columns.push(
        `${affix}${tableAffix}${
          path || hierarchy.model.name
        }${tableAffix}.${this.getUpdatedAtColumn(hierarchy.model)}${affix}`
      );
    }

    if (hierarchy.include?.length) {
      return _.flattenDeep(
        hierarchy.include.map((childHierarchy) => {
          const associationName = this.extractAssociationName(
            hierarchy.model,
            childHierarchy.model
          );

          return this.getUpdatedAtColumns({
            hierarchy: childHierarchy,
            path: `${path ? path + separator : ""}${associationName}`,
            columns,
            separator,
            affix,
          });
        })
      );
    } else {
      return _.flattenDeep(columns);
    }
  }

  /**
   * Generate a nested filter for updated_at properties
   *
   * @param value Filter value
   * @param operator Filter operator
   * @returns {[Op.or]: Record<string, Record<string, string>>[]}
   */
  public generateUpdatedAtFilter(
    value: string,
    operator: (typeof VALID_OPERATORS)[number],
    queryPath: string
  ): { [Op.or]: Record<string, Record<string, string>>[] } {
    if (!this.hasTimestamps()) {
      throw new ApplicationError(
        _.merge(ClientError.CRUD.BAD_REQUEST.INVALID_UPDATED_SINCE_FIELD, {
          params: { field: queryPath },
        })
      );
    }

    if (!this.isISOFormat(value)) {
      throw new ApplicationError(
        _.merge(ClientError.CRUD.BAD_REQUEST.INVALID_FORMAT_DATE_TIME, {
          params: { field: queryPath },
        })
      );
    }

    const updatedAtColumns = this.getUpdatedAtColumns({ affix: "$" });

    return {
      [Op.or]: _.uniq(updatedAtColumns).map((path) => ({
        [path]: { [Op[operator]]: value },
      })),
    };
  }

  /**
   * Generate a literal subquery to retrieve the latest updated_at value for an entity
   *
   * @returns Utils.Literal
   */
  public generateUpdatedAtLiteral(): Utils.Literal {
    const updatedAtColumns = _.uniq(
      this.getUpdatedAtColumns({ separator: "->" })
    );

    // GREATEST only works with multiple arguments
    const updatedAtClause =
      updatedAtColumns.length === 1
        ? `COALESCE(${updatedAtColumns[0]},DATE('1970-1-1'))`
        : `MAX(GREATEST(${updatedAtColumns.map(
            (column) => `COALESCE(${column},DATE('1970-1-1'))`
          )})) OVER (PARTITION BY ${this.model.name}.${
            this.model.primaryKeyAttribute
          })`;

    return Sequelize.literal(`CAST(${updatedAtClause} AS DATETIME)`);
  }

  /**
   * Verify if at least one model in the updatedAtHierarchy
   * (including this.model) has timestamps enabled
   *
   * @returns boolean
   */
  private hasTimestamps(): boolean {
    const allModels: ModelCtor<any>[] = [this.model];

    function collectAllModels(includes: UpdatedAtHierarchy) {
      allModels.push(includes.model);

      if (includes.include?.length) {
        includes.include.forEach(collectAllModels);
      }
    }

    this.updatedAtHierarchy.forEach(collectAllModels);

    return !!allModels.find((m) => m.options.timestamps);
  }
}
