import {
  ApplicationError,
  IApplicationErrorConstructorArguments,
} from "../errors/application-error.class";
import { Association, Utils } from "sequelize";
import { Model, ModelCtor } from "sequelize-typescript";

export abstract class AssociationBuilder<T extends Model<any, any>> {
  protected abstract model: ModelCtor<T>;
  protected abstract associationError: IApplicationErrorConstructorArguments;
  /**
   * A map of query parameter paths which can't be converted automatically
   * to a series of model associations for a given entity.
   * e.g. if the path is 'contacts.email', the Contacts > Address > email
   * association can't be inferred and we have to specify this case explicitly like so
   * { "contacts.email": "contacts.address.email" }
   */
  protected pathMap: Record<string, string | Utils.Literal> = {};

  protected getLastAssociationModel(
    associations: Association[]
  ): ModelCtor<Model<any, any>> {
    const [lastAssociation] = associations.slice(-1);

    return lastAssociation
      ? (lastAssociation.target as ModelCtor<Model<any, any>>)
      : this.model;
  }

  /**
   * Serialize a column name composed of a series of dot separated associations to a
   * column name to use as part of a top-level where clause understandable by sequelize.
   *
   * i.e. if we are referring to a nested column, we want to use the $column.field$ notation,
   * and if we are referring to a column that is on the base entity, we want to return it as is.
   *
   * @param column string
   * @returns string
   */
  protected serializeColumnName(column: string): string {
    return column.includes(".") ? `$${column}$` : column;
  }

  /**
   * Throw an error if the list of associations or the field
   * coming from a query parameter is invalid.
   *
   * @param associations Association[]
   * @param field string
   */
  protected validateAssociations(
    associations: Association[],
    field: string
  ): void {
    const hasInvalidAssociations = associations.some(
      (association) => !association
    );

    const model = this.getLastAssociationModel(associations);

    const isFieldInvalid = !(field in model.rawAttributes);

    if (hasInvalidAssociations || isFieldInvalid) {
      throw new ApplicationError(this.associationError);
    }
  }

  /**
   * Build a list of connected associations from a list of association names.
   *
   * @param names string[]
   * @returns Association[]
   */
  protected buildAssociations(names: string[]): Association[] {
    return names.reduce<Association[]>((associations, name) => {
      const model = this.getLastAssociationModel(associations);

      return [...associations, model.associations[name]];
    }, []);
  }

  /**
   * Extract and validate associations and field name from a path of the following format:
   * - 'field_name'
   * - 'association_name.field_name'
   * - 'association_name.association_name.field_name'
   * - further nested associations
   *
   * @param queryPath string
   * @returns { field: string | Utils.Literal; associations: Association[]; }
   */
  protected extractAndValidatePathData(queryPath: string): {
    field: string | Utils.Literal;
    associations: Association[];
  } {
    const path = this.pathMap[queryPath] || queryPath;

    if (path instanceof Utils.Literal) {
      return { associations: [], field: path };
    }

    const pathKeys = path.split(".");

    const field = pathKeys.pop();
    const associations = this.buildAssociations(pathKeys);

    this.validateAssociations(associations, field);

    return { associations, field };
  }
}
