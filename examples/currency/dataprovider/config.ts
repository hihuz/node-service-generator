import { FindOptions } from "sequelize";

/**
 * Base sequelize condition to fetch country.
 */
export const fetchCondition: FindOptions = {
  subQuery: false,
};

/**
 * Fields used to match currencies for the general search query parameter (&q=)
 */
export const searchFields = ["id", "name", "code", "symbol"];
