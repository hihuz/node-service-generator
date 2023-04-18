import * as _ from "lodash";
import { ClientError } from "../../errors/client-error.config";
import { Config } from "../../config/config";
import { ApplicationError } from "../../errors/application-error.class";

/**
 * Checks given or default pageSize against given or default maximumPageSize constraints.
 * Returns either pageSize or common api DEFAULT_PAGE_SIZE.
 * @param pageSize
 * @param maximumPageSize
 * @throws {ApplicationError} if pageSize > maximumPageSize
 * @returns pageSize
 */
export const getAndValidatePageSize = (
  pageSize?: number,
  maximumPageSize?: number
) => {
  pageSize = _.defaultTo(pageSize, Config.DEFAULT_PAGE_SIZE);

  if (!_.isNumber(maximumPageSize)) {
    const fromEnv = parseInt(process.env.MAXIMUM_PAGE_SIZE, 10);
    maximumPageSize = isNaN(fromEnv)
      ? Config.DEFAULT_MAXIMUM_PAGE_SIZE
      : fromEnv;
  }

  if (pageSize > maximumPageSize) {
    throw new ApplicationError(
      _.merge(ClientError.CRUD.BAD_REQUEST.VALIDATION_MAXIMUM_PAGE_SIZE, {
        params: {
          maximumPageSize: maximumPageSize,
          pageSize,
        },
      })
    );
  }

  return pageSize;
};
