import { Association } from "sequelize";
import { ModelCtor } from "sequelize-typescript";

export enum AssociationType {
  BELONGS_TO = "BelongsTo",
  HAS_ONE = "HasOne",
  BELONGS_TO_MANY = "BelongsToMany",
  HAS_MANY = "HasMany",
}

/**
 * BelongsToMany associations have additional attributes
 * which are not present in the official sequelize types.
 */
export type BelongsToManyAssociation = Association & {
  through: { model: ModelCtor };
  otherKey: string;
};
