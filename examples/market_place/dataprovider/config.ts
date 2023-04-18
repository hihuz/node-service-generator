import { FindOptions } from "sequelize";
import { PermissionsDefinitions } from "../../../src/common/generator/permissions-manager";
import Currency from "../../models/currency";
import { AuthContextMetadata } from "src/common/context/auth-context-metadata.class";
import { Permissions, Roles } from "examples/constants/permissions";

/**
 * Base sequelize condition to fetch market_place.
 */
export const fetchCondition: FindOptions = {
  subQuery: false,
  include: [
    { model: Currency, required: false, attributes: ["id", "name", "code"] },
  ],
};

/**
 * Custom permissions definitions applying on top of
 * the regular Crud controller permissions validations.
 */
export const permissionsDefinitions: PermissionsDefinitions = [
  {
    key: Permissions.MARKET_PLACE,
    shouldApply: (state: AuthContextMetadata): boolean => {
      const isRegularUser = !state.hasValue(Roles.ADMIN);

      return isRegularUser;
    },
  },
];
