export const ServerError = {
  AUTH: {
    INTERNAL_SERVER_ERROR: {
      ENV_SECRET_MISSING: {
        code: 500,
        error: "Environment variable missing",
        message: "Environment variable SECRET missing.",
      },
    },
  },

  ENVIRONMENT: {
    INTERNAL_SERVER_ERROR: {
      VARIABLE_MISSING: {
        code: 500,
        error: "Environment variable missing",
        message: (err: { params: { variable: string } }): string =>
          `Required environment variable missing: ${err.params.variable}.`,
      },
    },
  },

  CRUD: {
    INTERNAL_SERVER_ERROR: {
      INVALID_PERMISSION_DEFINITION: {
        code: 500,
        error: "Internal Server Error",
        message: "The service could not process this request.",
      },
      INVALID_UPDATED_AT_HIERARCHY: {
        code: 500,
        error: "Internal Server Error",
        message: (err: Record<string, any>): string =>
          `No association could be found for the source model (${err.params.source}) to the target model (${err.params.target}). Check the updatedAtHierarchy on your TimestampsManager.`,
      },
    },
  },

  SEQUELIZE: {
    INTERNAL_SERVER_ERROR: {
      ALREADY_INITIALIZED: {
        code: 500,
        error: "Internal Server Error",
        message: "Sequelize was already initialized.",
      },
    },
  },
};
