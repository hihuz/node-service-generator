import * as _ from "lodash";

export class AuthContextMetadata<
  T extends Record<string, any> = Record<string, any>
> {
  /**
   * Constructor.
   *
   * @param metadata data attached to the client/user combination
   */
  public constructor(private metadata: T) {}

  /**
   * @returns Metadata
   */
  public getMetadata(): T {
    return this.metadata;
  }

  public hasValue(key: keyof T): boolean {
    return Array.isArray(this.metadata[key])
      ? !_.isNil(this.metadata[key][0])
      : !_.isNil(this.metadata[key]);
  }
}
