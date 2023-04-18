import {
  AllowNull,
  Column,
  Default,
  DefaultScope,
  ForeignKey,
  Model,
} from "sequelize-typescript";
import Status, { EntityStatus } from "./status.model";

@DefaultScope(() => ({
  where: { status_id: EntityStatus.REGULAR },
  attributes: { exclude: ["status_id"] },
}))
export abstract class EntityModel<
  ModelAttributes = any,
  CreationAttributes = ModelAttributes
> extends Model<ModelAttributes, CreationAttributes> {
  @AllowNull(false)
  @Default(1)
  @ForeignKey(() => Status)
  @Column
  status_id!: EntityStatus;
}

export default EntityModel;
