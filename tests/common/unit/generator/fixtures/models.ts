import {
  AllowNull,
  BelongsTo,
  BelongsToMany,
  Column,
  ForeignKey,
  HasMany,
  HasOne,
  Model,
  Sequelize,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import { Order, ProductMetadata } from "./associated_models";

import EntityModel from "../../../../../src/common/models/entity.model";
import Info from "../../../../../src/common/models/info.model";
import { SequelizeConnection } from "../../../../../src/common/generator/connection";
import Status from "../../../../../src/common/models/status.model";
import SupplyNetwork from "../../../../../src/common/models/supply-network.model";

@Table({ timestamps: true })
export class DemandSource extends Model {
  @Column({ primaryKey: true, field: "numeric_code" })
  id: number;

  @Column
  name: string;

  @UpdatedAt
  last_change_date: Date;
}

// tableName added for test coverage
@Table({ tableName: "product", timestamps: true })
class Product extends EntityModel {
  @Column({ primaryKey: true })
  id: number;

  @Column
  name: string;

  @Column
  geo_restriction: 1 | 2;

  @Column
  available: boolean;

  @Column
  delivery_start_date: Date;

  @Column
  seat_id: number;

  @Column
  info_id: number;

  @ForeignKey(() => SupplyNetwork)
  @Column
  supply_network_id: number;

  @ForeignKey(() => DemandSource)
  @Column
  demand_source_id: number;

  @BelongsTo(() => SupplyNetwork)
  market_place: SupplyNetwork;

  @BelongsTo(() => DemandSource)
  demand_source: DemandSource;

  @HasOne(() => ProductMetadata)
  metadata: ProductMetadata;

  @HasMany(() => Order)
  orders: Order[];

  @BelongsToMany(() => Contact, () => ProductContact)
  contacts: Contact[];
}

@Table({ timestamps: true })
class Address extends Model {
  @Column({ primaryKey: true })
  id: number;

  @Column
  email?: string;

  @Column
  phone?: string;
}

@Table({ timestamps: true })
class Contact extends Model {
  @Column
  first_name: string;

  @Column
  last_name: string;

  @ForeignKey(() => Address)
  @Column
  address_id: number;

  @Column
  info_id: number;

  @BelongsTo(() => Address)
  address: Address;

  @BelongsToMany(() => Contact, () => ProductContact)
  contacts: Contact[];
}

@Table
class ProductContact extends Model {
  @AllowNull(false)
  @Column({ primaryKey: true })
  @ForeignKey(() => Contact)
  contact_id: number;

  @AllowNull(false)
  @Column({ primaryKey: true })
  @ForeignKey(() => Product)
  product_id: number;

  @BelongsTo(() => Product)
  product!: Product;

  @BelongsTo(() => Contact)
  contact!: Contact;
}

const createSequelizeInstance = (): Sequelize => {
  const environment = { ...process.env };
  process.env.DB_HOST = "host";
  process.env.DB_USER = "user";
  process.env.DB_PASSWORD = "password";
  process.env.DB_SCHEMA = "database";

  let sequelize: Sequelize;

  try {
    sequelize = SequelizeConnection.initialize({
      models: [
        Product,
        SupplyNetwork,
        DemandSource,
        Contact,
        Address,
        ProductContact,
        ProductMetadata,
        Order,
        Info,
        Status,
      ],
      dialect: "mysql",
    });
  } catch {
    sequelize = SequelizeConnection.getInstance();
  }

  process.env = environment;

  return sequelize;
};

export {
  Product,
  Contact,
  ProductContact,
  SupplyNetwork,
  Address,
  ProductMetadata,
  Order,
  createSequelizeInstance,
};
