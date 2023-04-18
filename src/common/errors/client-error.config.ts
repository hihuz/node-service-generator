export const ClientError = {
  AUTH: {
    FORBIDDEN: {
      NO_PERMISSIONS: {
        code: 403,
        error: "No permissions",
        message: "You do not have enough permissions to perform this request.",
      },
      NO_ACCESS: {
        code: 403,
        error: "No permissions",
        message: (err: Record<string, any>): string =>
          `You do not have access to ${err.params.key} '${err.params.value}'.`,
      },
    },
  },

  CRUD: {
    BAD_REQUEST: {
      INVALID_FORMAT_DATE_TIME: {
        code: 400,
        error: "Bad Request",
        message: (err: { params: { field: string } }): string =>
          `Provided '${err.params.field}' property should be in ISO format: YYYY-MM-DDTHH:MM:SSZ.`,
      },
      INVALID_UPDATED_SINCE_FIELD: {
        code: 400,
        error: "Bad Request",
        message: (err: { params: { field: string } }): string =>
          `The asked entity (or it\'s relations) do not contain any timestamp fields. \'${err.params.field}\'` +
          ` filter is therefore invalid.`,
      },
      INVALID_FILTER_OPERATOR: {
        code: 400,
        error: "Bad Request",
        message: (err: { params: { operator: string } }): string =>
          `Provided filter operator '${err.params.operator}' is invalid.`,
      },
      INVALID_FILTER_PARAMETER: {
        code: 400,
        error: "Bad Request",
        message: `Provided value for 'filter' parameter is invalid.`,
      },
      INVALID_IS_OPERATOR: {
        code: 400,
        error: "Bad Request",
        message: "Provided filter operator 'is' can only have 'null' value.",
      },
      INVALID_SORT_BY_OPERATOR: {
        code: 400,
        error: "Bad Request",
        message: "Provided 'sort_by' parameter is invalid.",
      },
      UNABLE_TO_CREATE: {
        code: 400,
        error: "Bad Request",
        message: "Item could not be created.",
      },
      UNABLE_TO_DELETE: {
        code: 400,
        error: "Bad Request",
        message: "Item could not be deleted.",
      },
      UNABLE_TO_GET: {
        code: 400,
        error: "Bad Request",
        message: "Item could not be retrieved.",
      },
      UNABLE_TO_LIST: {
        code: 400,
        error: "Bad Request",
        message: "Items could not be listed.",
      },
      UNABLE_TO_UPDATE: {
        code: 400,
        error: "Bad Request",
        message: "Item could not be updated.",
      },
      VALIDATION_IMMUTABLE_FIELD: {
        code: 400,
        error: "Validation Error",
        message: (err: { params: { field: string } }): string =>
          `Field '${err.params.field}' cannot be updated.`,
      },
      VALIDATION_INVALID_RELATION: {
        code: 400,
        error: "Validation Error",
        message: (err: { params: { field: string } }): string =>
          `Provided id for field '${err.params.field}' is invalid.`,
      },
      VALIDATION_MAXIMUM_PAGE_SIZE: {
        code: 400,
        error: "Validation Error",
        message: (err: Record<string, any>): string =>
          `The selected page size '${err.params.pageSize}' exceeds the maximum page of ` +
          `'${err.params.maximumPageSize}'.`,
      },
    },

    NOT_FOUND: {
      ITEM_NOT_FOUND: {
        code: 404,
        error: "Not found",
        message: "The item does not exist or you do not have access.",
      },
      RELATED_ENTITY_NOT_FOUND: {
        code: 400,
        error: "Not found",
        message: (err: Record<string, any>): string =>
          `The ${err.params.entity} (${err.params.id}) associated ` +
          `with this entity does not exist or you don't have access.`,
      },
    },
  },
};
