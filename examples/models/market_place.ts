import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from "sequelize-typescript";

import BaseSupplyNetwork from "../../src/common/models/supply-network.model";
import Currency from "./currency";

@Table({ tableName: "supply_network" })
export class MarketPlace extends BaseSupplyNetwork {
  @ForeignKey(() => Currency)
  @Column(DataType.SMALLINT.UNSIGNED)
  currency_numeric_code?: number;

  @BelongsTo(() => Currency)
  currency?: Currency;
}

export default MarketPlace;
