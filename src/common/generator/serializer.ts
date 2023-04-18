import { AuthContextMetadata } from "../context/auth-context-metadata.class";
import { Model } from "sequelize";

export class Serializer<
  T extends Model,
  InputDto = T["_creationAttributes"],
  ResponseDto = InputDto
> {
  /**
   * Serialize a database model instance and its associations
   * to a suitable entity to return by the API.
   *
   * @param item T
   * @param _state AuthContextMetadata
   * @returns ResponseDto
   */
  public serialize(item: T, _state: AuthContextMetadata): ResponseDto {
    return item.get({ plain: true });
  }

  /**
   * Deserialize an API input to suitable attributes
   * to upsert a database entity and its associations.
   *
   * @param input Partial<InputDto>
   * @param _state AuthContextMetadata
   * @param _item The existing entity, passed only for updates
   * @returns Partial<T["_creationAttributes"]>
   */
  public async deserialize(
    input: Partial<InputDto>,
    _state: AuthContextMetadata,
    _item?: ResponseDto
  ): Promise<Partial<T["_creationAttributes"]>> {
    return input;
  }
}
