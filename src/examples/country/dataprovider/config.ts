import { FindOptions } from "sequelize";

/**
 * Base sequelize condition to fetch country.
 */
export const fetchCondition: FindOptions = {
  subQuery: false,
};
