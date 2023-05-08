import _ from "lodash";

export class ApplicationError extends Error {
  public code: number;
  public error: string;
  public message: string;
  public internalError?: Error;

  public constructor(
    description: IApplicationErrorConstructorArguments,
    internalError?: Error
  ) {
    // ApplicationError should not be wrapped inside another error.
    if (internalError instanceof ApplicationError) {
      return internalError;
    }

    const error = _.isFunction(description.error)
      ? description.error(description)
      : description.error;
    const message = _.isFunction(description.message)
      ? description.message(description)
      : description.message;
    super(message);

    this.code = description.code;
    this.error = error;
    this.message = message;
    this.internalError = internalError;
  }
}

export interface IApplicationErrorConstructorArguments {
  code: number;
  error: ((err: any) => string) | string;
  message: ((err: any) => string) | string;
  params?: any;
}
