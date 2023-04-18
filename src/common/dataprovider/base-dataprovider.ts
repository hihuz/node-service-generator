import * as _ from "lodash";

export abstract class BaseDataProvider {
  /**
   * Deep merges the original and partial value and explicitly overwrites array values.
   *
   * @param original the original value
   * @param partial the partial value to patch to the original value
   * @returns the partial value merged into the original value
   */
  protected partialMerge<T = any, U = any>(original: T, partial: U): T {
    return _.mergeWith({}, original, partial, (oldValue, newValue) => {
      if (_.isArray(newValue)) {
        return newValue;
      }
    });
  }
}
