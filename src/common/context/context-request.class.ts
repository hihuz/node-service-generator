import * as _ from "lodash";

import { Config } from "../config/config";
import { getAndValidatePageSize } from "./utils/context-utils";

export class ContextRequest {
  private maximumPageSize: number;

  public constructor(private query: any) {
    const fromEnv = parseInt(process.env.MAXIMUM_PAGE_SIZE, 10);
    this.maximumPageSize = isNaN(fromEnv)
      ? Config.DEFAULT_MAXIMUM_PAGE_SIZE
      : fromEnv;
  }

  // GENERAL FUNCTIONS

  /**
   * Checks whether the given query parameter is present.
   *
   * @param name the name of the query parameter to check.
   *
   * @returns boolean true if the query parameter is present.
   */
  public has(name: string): boolean {
    return !_.isUndefined(this.query[name]);
  }

  /**
   * Returns the query parameter as is.
   *
   * @param name the name of the query parameter to check.
   * @param defaultValue the default value to return if the parameter is not present.
   *
   * @returns any the query parameter, the default value or undefined
   */
  public get(name: string, defaultValue?: any): any {
    return this.query[name] || defaultValue;
  }

  /**
   * Returns the query parameter as an array. If the value is not an array yet, it
   * will be wrapped into an array.
   *
   * @param name the name of the query parameter to check.
   * @param defaultValue the default value to return if the parameter is not present.
   *
   * @returns array the query parameter as an array, the default value or []
   */
  public getArray(name: string, defaultValue?: any): any {
    if (this.query[name]) {
      return _.castArray(this.query[name]);
    } else if (defaultValue) {
      return defaultValue;
    }

    return [];
  }

  /**
   * Returns the query parameter as a string.
   *
   * @param name the name of the query parameter to check.
   * @param defaultValue the default value to return if the parameter is not present.
   *
   * @returns any the query parameter, the default value or undefined
   */
  public getString(
    name: string,
    defaultString?: string,
    prefix = "",
    suffix = ""
  ): string {
    const value =
      this.query[name] && this.query[name].toString
        ? this.query[name].toString()
        : defaultString;

    return _.isUndefined(value) ? undefined : prefix + value + suffix;
  }

  /**
   * Returns the query parameter as a number.
   *
   * @param name the name of the query parameter to check.
   * @param defaultValue the default value to return if the parameter is not present.
   *
   * @returns any the query parameter, the default value or undefined
   */
  public getNumber(name: string, defaultNumber?: number): number {
    return this.query[name] ? +this.query[name] : defaultNumber;
  }

  // CONVENIENCE FUNCTIONS

  /**
   * Returns the page number to use for lists.
   *
   * @returns the page number or 1
   */
  public getPage(): number {
    return this.getNumber("page", 1);
  }

  /**
   * Returns the page size to use for lists.
   *
   * @returns the page size or the default page size
   */
  public getPageSize(): number {
    return getAndValidatePageSize(
      this.getNumber("page_size"),
      this.maximumPageSize
    );
  }

  /**
   * Sets the maximum page size. This can be used from the controller
   * to override the default maximum page size.
   *
   * @param maximum the maximum page size
   */
  public setMaximumPageSize(maximum: number): void {
    this.maximumPageSize = maximum;
  }

  /**
   * Returns the sorting parameter
   *
   * @returns the sort keyword
   */
  public getSortBy(): string {
    return this.getString("sort_by");
  }
}
